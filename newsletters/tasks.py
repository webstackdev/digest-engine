"""Celery tasks and helpers for newsletter intake processing."""

from celery import shared_task
from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from content.models import Content
from core.deduplication import canonicalize_url
from newsletters.models import IntakeAllowlist, NewsletterIntake, NewsletterIntakeStatus


@shared_task(name="core.tasks.process_newsletter_intake")
def process_newsletter_intake(intake_id: int):
    """Convert a stored newsletter email into content rows."""

    from core.newsletters import extract_newsletter_items

    intake = NewsletterIntake.objects.select_related("project").get(pk=intake_id)

    allowlist = IntakeAllowlist.objects.filter(
        project=intake.project,
        sender_email=intake.sender_email,
        confirmed_at__isnull=False,
    ).first()
    if allowlist is None:
        intake.status = NewsletterIntakeStatus.PENDING
        intake.error_message = "Sender has not confirmed newsletter intake."
        intake.save(update_fields=["status", "error_message"])
        return {"status": intake.status, "items_ingested": 0}

    extracted_items = extract_newsletter_items(
        subject=intake.subject,
        raw_html=intake.raw_html,
        raw_text=intake.raw_text,
    )
    ingested_count = 0
    for item in extracted_items:
        canonical_url = canonicalize_url(item.url)
        if (
            Content.objects.filter(
                project=intake.project,
                source_plugin="newsletter",
            )
            .filter(Q(canonical_url=canonical_url) | Q(url=item.url))
            .exists()
        ):
            continue
        content = Content.objects.create(
            project=intake.project,
            url=item.url,
            canonical_url=canonical_url,
            title=item.title[:512],
            author=intake.sender_email[:255],
            source_plugin="newsletter",
            published_date=timezone.now(),
            content_text=item.excerpt or intake.raw_text,
            source_metadata={
                "newsletter_intake_id": intake.id,
                "sender_email": intake.sender_email,
                "position": item.position,
            },
        )
        _schedule_content_processing(content)
        ingested_count += 1

    intake.status = NewsletterIntakeStatus.EXTRACTED
    intake.error_message = ""
    intake.extraction_result = {
        "method": "heuristic",
        "items": [
            {
                "url": item.url,
                "title": item.title,
                "excerpt": item.excerpt,
                "position": item.position,
            }
            for item in extracted_items
        ],
    }
    intake.save(update_fields=["status", "error_message", "extraction_result"])
    return {"status": intake.status, "items_ingested": ingested_count}


def _schedule_content_processing(content: Content) -> None:
    """Ensure a content row is embedded before it enters the AI pipeline."""

    from core.tasks import (
        assign_content_to_topic_cluster,
        process_content,
        upsert_content_embedding,
    )

    upsert_content_embedding(content)
    assign_content_to_topic_cluster(content.id)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        process_content(content.id)
    else:
        process_content.delay(content.id)
