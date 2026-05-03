"""Celery tasks and helpers for newsletter intake processing."""

from functools import lru_cache
from typing import Protocol, cast

from celery import shared_task
from celery.schedules import crontab_parser
from django.conf import settings
from django.db.models import Model, Q
from django.utils import timezone

from content.deduplication import canonicalize_url
from content.models import Content
from newsletters.composition import (
    generate_newsletter_draft as compose_newsletter_draft,
)
from newsletters.composition import (
    regenerate_newsletter_draft_section as compose_newsletter_draft_section,
)
from newsletters.extraction import extract_newsletter_payload
from newsletters.models import (
    IntakeAllowlist,
    NewsletterDraft,
    NewsletterDraftSection,
    NewsletterDraftStatus,
    NewsletterIntake,
    NewsletterIntakeStatus,
)
from notifications.emit import notify_project_admins
from notifications.models import NotificationLevel
from projects.models import Project, ProjectConfig


class DelayedTask(Protocol):
    """Protocol for Celery tasks dispatched through ``delay``."""

    def delay(self, *args: object, **kwargs: object) -> object:
        pass


def _enqueue_task(task: object, *args: object, **kwargs: object) -> None:
    """Dispatch a Celery task through a typed ``delay`` seam."""

    cast(DelayedTask, task).delay(*args, **kwargs)


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for newsletter intake processing."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


@shared_task(name="core.tasks.process_newsletter_intake")
def process_newsletter_intake(intake_id: int):
    """Convert a stored newsletter email into content rows."""

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

    extraction = extract_newsletter_payload(
        subject=intake.subject,
        raw_html=intake.raw_html,
        raw_text=intake.raw_text,
    )
    extracted_items = extraction.items
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
                "newsletter_intake_id": _require_pk(intake),
                "sender_email": intake.sender_email,
                "position": item.position,
            },
        )
        _schedule_content_processing(content)
        ingested_count += 1

    intake.status = NewsletterIntakeStatus.EXTRACTED
    intake.error_message = ""
    intake.extraction_result = {
        **extraction.metadata,
        "items_ingested": ingested_count,
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

    from core.embeddings import upsert_content_embedding
    from core.tasks import process_content
    from trends.tasks import assign_content_to_topic_cluster

    upsert_content_embedding(content)
    content_id = _require_pk(content)
    assign_content_to_topic_cluster(content_id)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        process_content(content_id)
    else:
        _enqueue_task(process_content, content_id)


@shared_task(name="core.tasks.generate_newsletter_draft")
def generate_newsletter_draft(
    project_id: int,
    trigger_source: str = "manual",
) -> dict[str, object]:
    """Compose one newsletter draft from accepted trend inputs."""

    project = Project.objects.get(pk=project_id)
    try:
        result = compose_newsletter_draft(project_id, trigger_source=trigger_source)
    except Exception as exc:
        notify_project_admins(
            project,
            level=NotificationLevel.ERROR,
            body="Newsletter draft generation failed.",
            link_path="/drafts",
            metadata={
                "project_id": project_id,
                "trigger_source": trigger_source,
                "error": str(exc),
            },
        )
        raise

    draft_id = result.get("draft_id")
    if result.get("status") == NewsletterDraftStatus.READY and isinstance(
        draft_id, int
    ):
        notify_project_admins(
            project,
            level=NotificationLevel.SUCCESS,
            body="Newsletter draft is ready.",
            link_path=f"/drafts/{draft_id}",
            metadata={
                "project_id": project_id,
                "draft_id": draft_id,
                "trigger_source": trigger_source,
                "status": str(result.get("status", "")),
            },
        )
    return result


@shared_task(name="core.tasks.run_all_scheduled_newsletter_drafts")
def run_all_scheduled_newsletter_drafts() -> dict[str, int]:
    """Queue scheduled newsletter drafts for projects whose cron matches now."""

    now = timezone.now()
    checked_count = 0
    queued_count = 0
    skipped_not_due_count = 0
    skipped_daily_cap_count = 0

    for config in ProjectConfig.objects.exclude(draft_schedule_cron="").only(
        "project_id",
        "draft_schedule_cron",
    ):
        checked_count += 1
        project_id = int(config.project_id)
        if not _cron_matches_now(config.draft_schedule_cron, now=now):
            skipped_not_due_count += 1
            continue
        if _project_has_scheduled_draft_today(project_id, now=now):
            skipped_daily_cap_count += 1
            continue
        if settings.CELERY_TASK_ALWAYS_EAGER:
            generate_newsletter_draft(project_id, trigger_source="scheduled")
        else:
            _enqueue_task(
                generate_newsletter_draft,
                project_id,
                trigger_source="scheduled",
            )
        queued_count += 1

    return {
        "checked": checked_count,
        "queued": queued_count,
        "skipped_not_due": skipped_not_due_count,
        "skipped_daily_cap": skipped_daily_cap_count,
    }


@shared_task(name="core.tasks.regenerate_newsletter_draft_section")
def regenerate_newsletter_draft_section(section_id: int) -> dict[str, object]:
    """Recompose one newsletter draft section in isolation."""

    section = NewsletterDraftSection.objects.select_related("draft__project").get(
        pk=section_id
    )
    project = section.draft.project
    draft_id = _require_pk(section.draft)
    try:
        result = compose_newsletter_draft_section(section_id)
    except Exception as exc:
        notify_project_admins(
            project,
            level=NotificationLevel.ERROR,
            body="Newsletter draft section regeneration failed.",
            link_path=f"/drafts/{draft_id}",
            metadata={
                "project_id": _require_pk(project),
                "draft_id": draft_id,
                "section_id": section_id,
                "error": str(exc),
            },
        )
        raise

    if result.get("status") == "completed":
        notify_project_admins(
            project,
            level=NotificationLevel.SUCCESS,
            body="Newsletter draft section refreshed.",
            link_path=f"/drafts/{draft_id}",
            metadata={
                "project_id": _require_pk(project),
                "draft_id": draft_id,
                "section_id": section_id,
                "status": str(result.get("status", "")),
            },
        )
    return result


def _project_has_scheduled_draft_today(project_id: int, *, now) -> bool:
    """Return whether the project already ran a scheduled draft today."""

    return NewsletterDraft.objects.filter(
        project_id=project_id,
        generated_at__date=timezone.localdate(now),
        generation_metadata__trigger_source="scheduled",
    ).exists()


def _cron_matches_now(cron_expression: str, *, now) -> bool:
    """Return whether the current local minute satisfies the cron expression."""

    try:
        minute_set, hour_set, day_set, month_set, weekday_set = _parse_cron_fields(
            cron_expression
        )
    except ValueError:
        return False

    current = timezone.localtime(now)
    weekday = current.isoweekday() % 7
    return (
        current.minute in minute_set
        and current.hour in hour_set
        and current.day in day_set
        and current.month in month_set
        and weekday in weekday_set
    )


@lru_cache(maxsize=128)
def _parse_cron_fields(cron_expression: str) -> tuple[
    set[int],
    set[int],
    set[int],
    set[int],
    set[int],
]:
    """Parse a normalized 5-part cron expression into comparable field sets."""

    normalized = " ".join(cron_expression.split())
    minute, hour, day_of_month, month_of_year, day_of_week = normalized.split(" ")
    return (
        crontab_parser(60).parse(minute),
        crontab_parser(24).parse(hour),
        crontab_parser(31, 1).parse(day_of_month),
        crontab_parser(12, 1).parse(month_of_year),
        crontab_parser(7).parse(day_of_week),
    )
