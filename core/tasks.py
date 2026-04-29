"""Celery tasks that drive ingestion, AI processing, and newsletter extraction."""

import math
import logging
from collections import defaultdict
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from core.deduplication import canonicalize_url
from core.embeddings import upsert_content_embedding
from core.models import (
    Content,
    Entity,
    EntityAuthoritySnapshot,
    EntityMention,
    EntityMentionRole,
    FeedbackType,
    IngestionRun,
    IntakeAllowlist,
    NewsletterIntake,
    NewsletterIntakeStatus,
    Project,
    ProjectConfig,
    RunStatus,
    SourceConfig,
    UserFeedback,
)
from core.newsletter_extraction import extract_newsletter_items
from core.pipeline import (
    RELEVANCE_SKILL_NAME,
    SUMMARIZATION_SKILL_NAME,
    create_pending_skill_result,
    execute_background_skill_result,
    process_content_pipeline,
)
from core.plugins import get_plugin_for_source_config

logger = logging.getLogger(__name__)

AUTHORITY_LOOKBACK_DAYS = 90
AUTHORITY_ROLE_SIGNALS = (
    EntityMentionRole.AUTHOR,
    EntityMentionRole.SUBJECT,
)


@shared_task(name="core.tasks.run_ingestion")
def run_ingestion(source_config_id: int):
    """Fetch new content for one source config and record an ingestion run.

    Args:
        source_config_id: Primary key of the source configuration to ingest.

    Returns:
        A summary containing fetched and ingested item counts.
    """

    source_config = SourceConfig.objects.select_related("project").get(
        pk=source_config_id
    )
    ingestion_run = IngestionRun.objects.create(
        project=source_config.project,
        plugin_name=source_config.plugin_name,
        status=RunStatus.RUNNING,
    )
    try:
        items_fetched, items_ingested = _ingest_source_config(source_config)
    except Exception as exc:
        ingestion_run.status = RunStatus.FAILED
        ingestion_run.completed_at = timezone.now()
        ingestion_run.error_message = str(exc)
        ingestion_run.save(update_fields=["status", "completed_at", "error_message"])
        logger.exception(
            "Source ingestion failed", extra={"source_config_id": source_config_id}
        )
        raise

    ingestion_run.status = RunStatus.SUCCESS
    ingestion_run.completed_at = timezone.now()
    ingestion_run.items_fetched = items_fetched
    ingestion_run.items_ingested = items_ingested
    ingestion_run.save(
        update_fields=["status", "completed_at", "items_fetched", "items_ingested"]
    )
    return {"items_fetched": items_fetched, "items_ingested": items_ingested}


@shared_task(name="core.tasks.run_all_ingestions")
def run_all_ingestions():
    """Queue ingestion for every active source configuration.

    Returns:
        The number of source configurations scheduled.
    """

    source_config_ids = list(
        SourceConfig.objects.filter(is_active=True).values_list("id", flat=True)
    )
    for source_config_id in source_config_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            run_ingestion(source_config_id)
        else:
            run_ingestion.delay(source_config_id)
    return len(source_config_ids)


@shared_task(name="core.tasks.process_content")
def process_content(content_id: int):
    """Run the main AI pipeline for a stored content item."""

    return process_content_pipeline(content_id)


@shared_task(name="core.tasks.recompute_authority_scores")
def recompute_authority_scores(project_id: int):
    """Rebuild authority scores and snapshots for one project's entities."""

    project = Project.objects.get(pk=project_id)
    config, _ = ProjectConfig.objects.get_or_create(project=project)
    entities = list(
        Entity.objects.filter(project=project).only("id", "authority_score")
    )
    if not entities:
        return {"project_id": project_id, "entities_updated": 0}

    now = timezone.now()
    window_start = now - timedelta(days=AUTHORITY_LOOKBACK_DAYS)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    mention_counts = dict(
        EntityMention.objects.filter(project=project, created_at__gte=window_start)
        .values("entity_id")
        .annotate(total=Count("id"))
        .values_list("entity_id", "total")
    )

    entity_content_ids: dict[int, set[int]] = defaultdict(set)
    content_entity_ids: dict[int, set[int]] = defaultdict(set)
    direct_entity_content_ids = list(
        Content.objects.filter(
            project=project,
            entity_id__isnull=False,
            published_date__gte=window_start,
        ).values_list("entity_id", "id")
    )
    for entity_id, content_id in direct_entity_content_ids:
        entity_content_ids[entity_id].add(content_id)
        content_entity_ids[content_id].add(entity_id)

    mention_entity_content_ids = list(
        EntityMention.objects.filter(
            project=project,
            created_at__gte=window_start,
            role__in=AUTHORITY_ROLE_SIGNALS,
        )
        .values_list("entity_id", "content_id")
        .distinct()
    )
    for entity_id, content_id in mention_entity_content_ids:
        entity_content_ids[entity_id].add(content_id)
        content_entity_ids[content_id].add(entity_id)

    scoped_content_ids = list(content_entity_ids.keys())
    feedback_totals: dict[int, float] = defaultdict(float)
    for content_id, feedback_type in UserFeedback.objects.filter(
        project=project,
        created_at__gte=window_start,
        content_id__in=scoped_content_ids,
    ).values_list("content_id", "feedback_type"):
        weight = (
            config.upvote_authority_weight
            if feedback_type == FeedbackType.UPVOTE
            else config.downvote_authority_weight
        )
        for entity_id in content_entity_ids.get(content_id, ()):
            feedback_totals[entity_id] += weight

    duplicate_totals: dict[int, int] = defaultdict(int)
    for content_id, duplicate_signal_count in Content.objects.filter(
        project=project,
        published_date__gte=window_start,
        duplicate_signal_count__gt=0,
        id__in=scoped_content_ids,
    ).values_list("id", "duplicate_signal_count"):
        for entity_id in content_entity_ids.get(content_id, ()):
            duplicate_totals[entity_id] += duplicate_signal_count

    max_mention_count = max(mention_counts.values(), default=0)
    max_duplicate_count = max(duplicate_totals.values(), default=0)
    max_abs_feedback = max(
        (abs(value) for value in feedback_totals.values()), default=0.0
    )

    entity_updates = []
    snapshots = []
    snapshot_history = {
        entity.id: list(
            EntityAuthoritySnapshot.objects.filter(entity=entity)
            .order_by("-computed_at")
            .only("computed_at", "final_score")
        )
        for entity in entities
    }

    with transaction.atomic():
        for entity in entities:
            mention_component = _normalize_log_scaled_component(
                mention_counts.get(entity.id, 0),
                max_mention_count,
            )
            feedback_component = _normalize_signed_component(
                feedback_totals.get(entity.id, 0.0),
                max_abs_feedback,
            )
            duplicate_component = _normalize_log_scaled_component(
                duplicate_totals.get(entity.id, 0),
                max_duplicate_count,
            )
            decayed_prior = _get_decayed_prior_score(
                entity=entity,
                month_start=month_start,
                authority_decay_rate=config.authority_decay_rate,
                snapshot_history=snapshot_history.get(entity.id, []),
            )
            final_score = _clamp_unit_interval(
                (
                    decayed_prior
                    + mention_component
                    + feedback_component
                    + duplicate_component
                )
                / 4
            )

            entity.authority_score = final_score
            entity_updates.append(entity)
            snapshots.append(
                EntityAuthoritySnapshot(
                    entity=entity,
                    project=project,
                    mention_component=mention_component,
                    feedback_component=feedback_component,
                    duplicate_component=duplicate_component,
                    decayed_prior=decayed_prior,
                    final_score=final_score,
                )
            )

        Entity.objects.bulk_update(entity_updates, ["authority_score"])
        EntityAuthoritySnapshot.objects.bulk_create(snapshots)

    return {"project_id": project_id, "entities_updated": len(entity_updates)}


@shared_task(name="core.tasks.run_relevance_scoring_skill", ignore_result=True)
def run_relevance_scoring_skill(skill_result_id: int):
    """Execute a pending ad hoc relevance skill result in the background."""

    return execute_background_skill_result(skill_result_id, RELEVANCE_SKILL_NAME)


@shared_task(name="core.tasks.run_summarization_skill", ignore_result=True)
def run_summarization_skill(skill_result_id: int):
    """Execute a pending ad hoc summarization skill result in the background."""

    return execute_background_skill_result(skill_result_id, SUMMARIZATION_SKILL_NAME)


def queue_content_skill(content: Content, skill_name: str):
    """Create and dispatch an asynchronous ad hoc skill for a content row.

    Args:
        content: The content row to process.
        skill_name: Supported async skill name.

    Returns:
        The refreshed ``SkillResult`` row after the task has been queued or eagerly
        executed.
    """

    skill_result = create_pending_skill_result(content, skill_name)

    if skill_name == RELEVANCE_SKILL_NAME:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            run_relevance_scoring_skill(skill_result.id)
        else:
            run_relevance_scoring_skill.delay(skill_result.id)
    elif skill_name == SUMMARIZATION_SKILL_NAME:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            run_summarization_skill(skill_result.id)
        else:
            run_summarization_skill.delay(skill_result.id)
    else:
        raise ValueError(f"Unsupported async skill name: {skill_name}")

    skill_result.refresh_from_db()
    return skill_result


def _normalize_log_scaled_component(value: int, max_value: int) -> float:
    """Normalize a non-negative count into the authority component range [0.5, 1]."""

    if max_value <= 0:
        return 0.5
    return _clamp_unit_interval(0.5 + 0.5 * (math.log1p(value) / math.log1p(max_value)))


def _normalize_signed_component(value: float, max_abs_value: float) -> float:
    """Normalize a signed signal into the authority component range [0, 1]."""

    if max_abs_value <= 0:
        return 0.5
    return _clamp_unit_interval(0.5 + 0.5 * (value / max_abs_value))


def _get_decayed_prior_score(
    *,
    entity: Entity,
    month_start,
    authority_decay_rate: float,
    snapshot_history,
) -> float:
    """Return the carried-forward authority score for the current recomputation."""

    previous_month_snapshot = next(
        (
            snapshot
            for snapshot in snapshot_history
            if snapshot.computed_at < month_start
        ),
        None,
    )
    if previous_month_snapshot is not None:
        return _clamp_unit_interval(
            float(previous_month_snapshot.final_score) * authority_decay_rate
        )
    if snapshot_history:
        return _clamp_unit_interval(float(snapshot_history[0].final_score))
    return _clamp_unit_interval(
        float(entity.authority_score or 0.5) * authority_decay_rate
    )


def _clamp_unit_interval(value: float) -> float:
    """Clamp a floating-point score into the inclusive [0, 1] range."""

    return max(0.0, min(1.0, float(value)))


def _ingest_source_config(source_config: SourceConfig) -> tuple[int, int]:
    """Fetch items from a configured source and create new content rows."""

    plugin = get_plugin_for_source_config(source_config)
    fetched_items = plugin.fetch_new_content(source_config.last_fetched_at)
    ingested_count = 0
    for item in fetched_items:
        if _content_exists_for_item(source_config, item):
            continue
        source_metadata = getattr(item, "source_metadata", None) or {}
        content = Content.objects.create(
            project=source_config.project,
            entity=_match_entity_for_item(plugin, item),
            url=item.url,
            canonical_url=canonicalize_url(item.url),
            title=item.title[:512],
            author=item.author[:255],
            source_plugin=item.source_plugin,
            published_date=item.published_date,
            content_text=item.content_text,
            source_metadata=source_metadata,
        )
        _schedule_content_processing(content)
        ingested_count += 1
    source_config.last_fetched_at = timezone.now()
    source_config.save(update_fields=["last_fetched_at"])
    return len(fetched_items), ingested_count


def _content_exists_for_item(source_config: SourceConfig, item) -> bool:
    """Check whether a fetched item already exists for the project."""

    post_uri = (getattr(item, "source_metadata", None) or {}).get("post_uri")
    if post_uri:
        return Content.objects.filter(
            project=source_config.project,
            source_plugin=item.source_plugin,
            source_metadata__post_uri=post_uri,
        ).exists()
    canonical_url = canonicalize_url(item.url)
    return (
        Content.objects.filter(
            project=source_config.project,
            source_plugin=item.source_plugin,
        )
        .filter(Q(canonical_url=canonical_url) | Q(url=item.url))
        .exists()
    )


def _match_entity_for_item(plugin, item):
    """Resolve the entity for an item while preserving older plugin mocks."""

    if callable(getattr(type(plugin), "match_entity_for_item", None)):
        return plugin.match_entity_for_item(item)
    return plugin.match_entity_for_url(item.url)


@shared_task(name="core.tasks.process_newsletter_intake")
def process_newsletter_intake(intake_id: int):
    """Convert a stored newsletter email into content rows.

    Args:
        intake_id: Primary key of the ``NewsletterIntake`` row to process.

    Returns:
        A summary containing the final intake status and ingested item count.
    """

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

    upsert_content_embedding(content)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        process_content(content.id)
    else:
        process_content.delay(content.id)
