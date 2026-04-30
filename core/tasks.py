"""Celery tasks that drive ingestion, AI processing, and newsletter extraction."""

import logging
import math
from collections import defaultdict
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from core.deduplication import canonicalize_url
from core.embeddings import (
    build_content_embedding_text,
    delete_topic_centroid,
    embed_text,
    upsert_content_embedding,
    upsert_topic_centroid,
)
from core.models import (
    Content,
    FeedbackType,
    IngestionRun,
    IntakeAllowlist,
    NewsletterIntake,
    NewsletterIntakeStatus,
    RunStatus,
    TopicCentroidSnapshot,
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
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityMention,
    EntityMentionRole,
)
from projects.models import Project, ProjectConfig, SourceConfig

logger = logging.getLogger(__name__)

AUTHORITY_LOOKBACK_DAYS = 90
AUTHORITY_ROLE_SIGNALS = (
    EntityMentionRole.AUTHOR,
    EntityMentionRole.SUBJECT,
)
TOPIC_CENTROID_LOOKBACK_DAYS = 90
TOPIC_CENTROID_MIN_UPVOTES = 10
TOPIC_CENTROID_DOWNVOTE_WEIGHT = 0.25
TOPIC_CENTROID_DEBOUNCE_SECONDS = 60 * 5
TOPIC_CENTROID_DECAY_TAU_DAYS = 45


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


@shared_task(name="core.tasks.run_all_authority_recomputations")
def run_all_authority_recomputations():
    """Queue authority recomputation for every project.

    Returns:
        The number of projects scheduled for authority recomputation.
    """

    project_ids = list(Project.objects.values_list("id", flat=True))
    for project_id in project_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            recompute_authority_scores(project_id)
        else:
            recompute_authority_scores.delay(project_id)
    return len(project_ids)


@shared_task(name="core.tasks.run_all_topic_centroid_recomputations")
def run_all_topic_centroid_recomputations():
    """Queue topic-centroid recomputation for every project."""

    project_ids = list(Project.objects.values_list("id", flat=True))
    for project_id in project_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            recompute_topic_centroid(project_id)
        else:
            recompute_topic_centroid.delay(project_id)
    return len(project_ids)


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


@shared_task(name="core.tasks.recompute_topic_centroid")
def recompute_topic_centroid(project_id: int):
    """Rebuild the project's feedback centroid from recent editorial signals."""

    now = timezone.now()
    window_start = now - timedelta(days=TOPIC_CENTROID_LOOKBACK_DAYS)
    feedback_rows = list(
        UserFeedback.objects.filter(project_id=project_id, created_at__gte=window_start)
        .select_related("content")
        .order_by("created_at")
    )
    upvote_count = sum(
        1 for row in feedback_rows if row.feedback_type == FeedbackType.UPVOTE
    )
    downvote_count = sum(
        1 for row in feedback_rows if row.feedback_type == FeedbackType.DOWNVOTE
    )

    try:
        if upvote_count < TOPIC_CENTROID_MIN_UPVOTES:
            delete_topic_centroid(project_id)
            _create_topic_centroid_snapshot(
                project_id=project_id,
                computed_at=now,
                centroid_active=False,
                centroid_vector=[],
                feedback_count=len(feedback_rows),
                upvote_count=upvote_count,
                downvote_count=downvote_count,
            )
            return {
                "project_id": project_id,
                "feedback_count": len(feedback_rows),
                "upvote_count": upvote_count,
                "downvote_count": downvote_count,
                "centroid_active": False,
            }

        vector_cache: dict[int, list[float]] = {}
        upvote_vectors: list[tuple[list[float], float]] = []
        downvote_vectors: list[tuple[list[float], float]] = []

        for feedback in feedback_rows:
            vector = vector_cache.get(feedback.content_id)
            if vector is None:
                vector = embed_text(build_content_embedding_text(feedback.content))
                vector_cache[feedback.content_id] = vector
            weight = _feedback_decay_weight(feedback.created_at, now)
            if feedback.feedback_type == FeedbackType.UPVOTE:
                upvote_vectors.append((vector, weight))
            else:
                downvote_vectors.append((vector, weight))

        upvote_mean, upvote_weight = _weighted_mean_vector(upvote_vectors)
        if not upvote_mean or upvote_weight <= 0:
            delete_topic_centroid(project_id)
            _create_topic_centroid_snapshot(
                project_id=project_id,
                computed_at=now,
                centroid_active=False,
                centroid_vector=[],
                feedback_count=len(feedback_rows),
                upvote_count=upvote_count,
                downvote_count=downvote_count,
            )
            return {
                "project_id": project_id,
                "feedback_count": len(feedback_rows),
                "upvote_count": upvote_count,
                "downvote_count": downvote_count,
                "centroid_active": False,
            }

        downvote_mean, downvote_weight = _weighted_mean_vector(downvote_vectors)
        downvote_scale = 0.0
        if downvote_mean and downvote_weight > 0:
            downvote_scale = TOPIC_CENTROID_DOWNVOTE_WEIGHT * min(
                1.0, upvote_weight / downvote_weight
            )

        centroid_vector = [
            upvote_value - downvote_scale * downvote_value
            for upvote_value, downvote_value in zip(
                upvote_mean,
                downvote_mean or [0.0] * len(upvote_mean),
            )
        ]
        normalized_centroid = _normalize_vector(centroid_vector)
        if not normalized_centroid:
            delete_topic_centroid(project_id)
            _create_topic_centroid_snapshot(
                project_id=project_id,
                computed_at=now,
                centroid_active=False,
                centroid_vector=[],
                feedback_count=len(feedback_rows),
                upvote_count=upvote_count,
                downvote_count=downvote_count,
            )
            return {
                "project_id": project_id,
                "feedback_count": len(feedback_rows),
                "upvote_count": upvote_count,
                "downvote_count": downvote_count,
                "centroid_active": False,
            }

        upsert_topic_centroid(
            project_id,
            normalized_centroid,
            upvote_count=upvote_count,
            downvote_count=downvote_count,
            feedback_count=len(feedback_rows),
        )
        _create_topic_centroid_snapshot(
            project_id=project_id,
            computed_at=now,
            centroid_active=True,
            centroid_vector=normalized_centroid,
            feedback_count=len(feedback_rows),
            upvote_count=upvote_count,
            downvote_count=downvote_count,
        )
        return {
            "project_id": project_id,
            "feedback_count": len(feedback_rows),
            "upvote_count": upvote_count,
            "downvote_count": downvote_count,
            "centroid_active": True,
        }
    finally:
        cache.delete(_topic_centroid_debounce_key(project_id))


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


def queue_topic_centroid_recompute(project_id: int) -> bool:
    """Debounce and queue topic-centroid recomputation for one project."""

    if not cache.add(
        _topic_centroid_debounce_key(project_id),
        timezone.now().isoformat(),
        timeout=TOPIC_CENTROID_DEBOUNCE_SECONDS,
    ):
        return False

    if settings.CELERY_TASK_ALWAYS_EAGER:
        recompute_topic_centroid(project_id)
    else:
        recompute_topic_centroid.delay(project_id)
    return True


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


def _feedback_decay_weight(created_at, now) -> float:
    """Return the EMA-style decay weight for one feedback event."""

    age_days = max(0.0, (now - created_at).total_seconds() / 86400)
    return math.exp(-age_days / TOPIC_CENTROID_DECAY_TAU_DAYS)


def _create_topic_centroid_snapshot(
    *,
    project_id: int,
    computed_at,
    centroid_active: bool,
    centroid_vector: list[float],
    feedback_count: int,
    upvote_count: int,
    downvote_count: int,
) -> TopicCentroidSnapshot:
    """Persist one centroid snapshot and derived drift metrics."""

    previous_active_snapshot = (
        TopicCentroidSnapshot.objects.filter(
            project_id=project_id, centroid_active=True
        )
        .order_by("-computed_at")
        .only("centroid_vector", "computed_at")
        .first()
    )
    week_ago_snapshot = (
        TopicCentroidSnapshot.objects.filter(
            project_id=project_id,
            centroid_active=True,
            computed_at__lte=computed_at - timedelta(days=7),
        )
        .order_by("-computed_at")
        .only("centroid_vector", "computed_at")
        .first()
    )

    snapshot = TopicCentroidSnapshot.objects.create(
        project_id=project_id,
        centroid_active=centroid_active,
        centroid_vector=centroid_vector,
        feedback_count=feedback_count,
        upvote_count=upvote_count,
        downvote_count=downvote_count,
        drift_from_previous=(
            _cosine_distance(centroid_vector, previous_active_snapshot.centroid_vector)
            if centroid_active and previous_active_snapshot is not None
            else None
        ),
        drift_from_week_ago=(
            _cosine_distance(centroid_vector, week_ago_snapshot.centroid_vector)
            if centroid_active and week_ago_snapshot is not None
            else None
        ),
    )
    if snapshot.computed_at != computed_at:
        TopicCentroidSnapshot.objects.filter(pk=snapshot.pk).update(
            computed_at=computed_at
        )
        snapshot.computed_at = computed_at
    return snapshot


def _cosine_distance(left: list[float], right: list[float]) -> float | None:
    """Return cosine distance between two vectors when both are usable."""

    if not left or not right or len(left) != len(right):
        return None
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm <= 0 or right_norm <= 0:
        return None
    cosine_similarity = sum(
        left_value * right_value for left_value, right_value in zip(left, right)
    ) / (left_norm * right_norm)
    return max(0.0, min(2.0, 1.0 - max(-1.0, min(1.0, cosine_similarity))))


def _weighted_mean_vector(
    weighted_vectors: list[tuple[list[float], float]],
) -> tuple[list[float], float]:
    """Compute the weighted mean vector and total contributing weight."""

    if not weighted_vectors:
        return [], 0.0
    dimension = len(weighted_vectors[0][0])
    totals = [0.0] * dimension
    total_weight = 0.0
    for vector, weight in weighted_vectors:
        total_weight += weight
        for index, value in enumerate(vector):
            totals[index] += float(value) * weight
    if total_weight <= 0:
        return [], 0.0
    return ([value / total_weight for value in totals], total_weight)


def _normalize_vector(vector: list[float]) -> list[float]:
    """Normalize a dense vector to unit length."""

    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude <= 0:
        return []
    return [float(value) / magnitude for value in vector]


def _topic_centroid_debounce_key(project_id: int) -> str:
    """Return the cache key used to debounce centroid recomputations."""

    return f"topic-centroid-recompute:{project_id}"


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
