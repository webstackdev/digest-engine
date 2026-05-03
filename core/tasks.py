"""Celery tasks that drive ingestion, AI processing, and newsletter extraction."""

import logging
import math
from collections import defaultdict
from datetime import timedelta
from typing import Protocol, cast

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Model, Q
from django.utils import timezone

from content.models import Content, FeedbackType, UserFeedback
from core.embeddings import upsert_content_embedding
from core.pipeline import (
    RELEVANCE_SKILL_NAME,
    SUMMARIZATION_SKILL_NAME,
    create_pending_skill_result,
    execute_background_skill_result,
    process_content_pipeline,
)
from core.pipeline import (
    retry_review_queue_item as retry_review_queue_item_from_pipeline,
)
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityMention,
    EntityMentionRole,
)
from pipeline.models import ReviewQueue
from pipeline.resilience import opened_circuit_breakers, probe_circuit_breaker
from projects.models import Project, ProjectConfig
from trends.models import (
    SourceDiversitySnapshot,
    TopicCentroidSnapshot,
    TopicVelocitySnapshot,
    TrendTaskRun,
)

logger = logging.getLogger(__name__)

AUTHORITY_LOOKBACK_DAYS = 90
AUTHORITY_RECENCY_HALF_LIFE_DAYS = 30
AUTHORITY_ROLE_SIGNALS = (
    EntityMentionRole.AUTHOR,
    EntityMentionRole.SUBJECT,
)

__all__ = [
    "apply_retention_policies",
    "circuit_breaker_health_check",
    "recompute_source_quality",
    "recompute_authority_scores",
    "run_all_source_quality_recomputations",
    "run_all_authority_recomputations",
    "run_all_retention_policies",
    "run_relevance_scoring_skill",
    "run_summarization_skill",
    "queue_content_skill",
    "process_content",
    "retry_pipeline_review_item",
]


class DelayedTask(Protocol):
    """Protocol for Celery tasks that can run eagerly or via ``delay``."""

    def __call__(self, *args: object, **kwargs: object) -> object:
        pass

    def delay(self, *args: object, **kwargs: object) -> object:
        pass


def _enqueue_task(task: object, *args: object) -> None:
    """Dispatch a Celery task through a typed ``delay`` seam."""

    cast(DelayedTask, task).delay(*args)


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key as an ``int``."""

    pk = instance.pk
    if pk is None:
        raise ValueError(
            f"{instance.__class__.__name__} must be saved before task dispatch"
        )
    return int(pk)


def _retention_cutoff(days: int):
    """Return the timestamp cutoff for a retention window in days."""

    return timezone.now() - timedelta(days=days)


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
            _enqueue_task(recompute_authority_scores, project_id)

    return len(project_ids)


@shared_task(name="core.tasks.run_all_source_quality_recomputations")
def run_all_source_quality_recomputations() -> int:
    """Queue source-quality recomputation for every project."""

    project_ids = list(Project.objects.values_list("id", flat=True))
    for project_id in project_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            recompute_source_quality(project_id)
        else:
            _enqueue_task(recompute_source_quality, project_id)
    return len(project_ids)


@shared_task(name="core.tasks.run_all_retention_policies")
def run_all_retention_policies() -> int:
    """Queue retention-policy cleanup for every project."""

    project_ids = list(Project.objects.values_list("id", flat=True))
    for project_id in project_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            apply_retention_policies(project_id)
        else:
            _enqueue_task(apply_retention_policies, project_id)
    return len(project_ids)


@shared_task(name="core.tasks.process_content")
def process_content(content_id: int):
    """Run the main AI pipeline for a stored content item."""

    return process_content_pipeline(content_id)


@shared_task(name="core.tasks.circuit_breaker_health_check")
def circuit_breaker_health_check() -> dict[str, object]:
    """Probe opened circuit breakers and close the ones that recover."""

    opened = opened_circuit_breakers()
    recovered: list[str] = []
    for breaker in opened:
        try:
            if probe_circuit_breaker(breaker.skill_name):
                recovered.append(breaker.skill_name)
        except Exception:
            logger.exception(
                "Circuit breaker health probe failed for %s", breaker.skill_name
            )
    return {
        "opened_breaker_count": len(opened),
        "recovered_breakers": recovered,
    }


@shared_task(name="core.tasks.retry_pipeline_review_item")
def retry_pipeline_review_item(review_item_id: int) -> dict[str, object]:
    """Retry one pipeline review item from its failed node."""

    review_item = ReviewQueue.objects.select_related("content", "project").get(
        pk=review_item_id
    )
    return retry_review_queue_item_from_pipeline(review_item)


@shared_task(name="core.tasks.apply_retention_policies")
def apply_retention_policies(project_id: int) -> dict[str, object]:
    """Delete old observability records for one project."""

    project = Project.objects.get(pk=project_id)
    snapshot_cutoff = _retention_cutoff(settings.OBSERVABILITY_SNAPSHOT_RETENTION_DAYS)
    trend_run_cutoff = _retention_cutoff(
        settings.OBSERVABILITY_TREND_TASK_RUN_RETENTION_DAYS
    )
    review_cutoff = _retention_cutoff(
        settings.OBSERVABILITY_REVIEW_QUEUE_RETENTION_DAYS
    )

    deleted = {
        "topic_centroid_snapshots": TopicCentroidSnapshot.objects.filter(
            project=project,
            computed_at__lt=snapshot_cutoff,
        ).delete()[0],
        "topic_velocity_snapshots": TopicVelocitySnapshot.objects.filter(
            project=project,
            computed_at__lt=snapshot_cutoff,
        ).delete()[0],
        "source_diversity_snapshots": SourceDiversitySnapshot.objects.filter(
            project=project,
            computed_at__lt=snapshot_cutoff,
        ).delete()[0],
        "entity_authority_snapshots": EntityAuthoritySnapshot.objects.filter(
            project=project,
            computed_at__lt=snapshot_cutoff,
        ).delete()[0],
        "trend_task_runs": TrendTaskRun.objects.filter(project=project)
        .filter(
            Q(finished_at__lt=trend_run_cutoff)
            | Q(finished_at__isnull=True, started_at__lt=trend_run_cutoff)
        )
        .delete()[0],
        "resolved_review_items": ReviewQueue.objects.filter(
            project=project,
            resolved=True,
            resolved_at__lt=review_cutoff,
        ).delete()[0],
    }

    return {
        "project_id": project_id,
        "deleted": deleted,
        "snapshot_cutoff": snapshot_cutoff.isoformat(),
        "trend_run_cutoff": trend_run_cutoff.isoformat(),
        "review_cutoff": review_cutoff.isoformat(),
    }


@shared_task(name="core.tasks.recompute_source_quality")
def recompute_source_quality(project_id: int) -> dict[str, object]:
    """Recompute source-quality scores used by entity authority scoring."""

    project = Project.objects.get(pk=project_id)
    now = timezone.now()
    window_start = now - timedelta(days=AUTHORITY_LOOKBACK_DAYS)
    recent_contents = list(
        Content.objects.filter(
            project=project,
            is_active=True,
            published_date__gte=window_start,
        )
        .only(
            "id",
            "project_id",
            "entity_id",
            "source_plugin",
            "source_metadata",
            "published_date",
            "canonical_url",
            "url",
        )
        .order_by("published_date", "id")
    )
    author_entity_ids = _author_entities_for_contents(recent_contents)
    source_quality_scores = _compute_source_quality_scores(
        contents=recent_contents,
        author_entity_ids=author_entity_ids,
    )
    return {
        "project_id": project_id,
        "source_count": len(source_quality_scores),
        "source_scores": source_quality_scores,
    }


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
    recent_contents = list(
        Content.objects.filter(
            project=project,
            is_active=True,
            published_date__gte=window_start,
        )
        .only(
            "id",
            "project_id",
            "entity_id",
            "source_plugin",
            "source_metadata",
            "published_date",
            "canonical_url",
            "url",
            "duplicate_signal_count",
        )
        .order_by("published_date", "id")
    )
    content_by_id = {_require_pk(content): content for content in recent_contents}
    author_entity_ids = _author_entities_for_contents(recent_contents)
    source_quality_scores = _compute_source_quality_scores(
        contents=recent_contents,
        author_entity_ids=author_entity_ids,
    )
    newsletter_projects_by_url = _newsletter_projects_by_url(
        contents=recent_contents,
        window_start=window_start,
    )
    normalized_weights = _normalized_authority_weights(config)

    entity_content_ids: dict[int, set[int]] = defaultdict(set)
    content_entity_ids: dict[int, set[int]] = defaultdict(set)
    for content_id, content in content_by_id.items():
        if content.entity_id is None:
            continue
        entity_id = int(content.entity_id)
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

    engagement_totals: dict[int, float] = defaultdict(float)
    recency_sums: dict[int, float] = defaultdict(float)
    recency_counts: dict[int, int] = defaultdict(int)
    source_quality_sums: dict[int, float] = defaultdict(float)
    source_quality_counts: dict[int, int] = defaultdict(int)
    cross_newsletter_projects: dict[int, set[int]] = defaultdict(set)

    for content_id, content in content_by_id.items():
        author_entity_id = author_entity_ids.get(content_id)
        if author_entity_id is not None:
            engagement_totals[author_entity_id] += _engagement_total_for_content(
                content,
                newsletter_projects_by_url,
            )

    for entity_id, content_ids in entity_content_ids.items():
        for content_id in content_ids:
            scoped_content = content_by_id.get(content_id)
            if scoped_content is None:
                continue
            recency_sums[entity_id] += _recency_weight_for_content(
                scoped_content,
                now=now,
            )
            recency_counts[entity_id] += 1
            source_key = _authority_source_bucket_key(scoped_content)
            source_quality_sums[entity_id] += source_quality_scores.get(source_key, 0.0)
            source_quality_counts[entity_id] += 1
            url_key = _content_url_key(scoped_content)
            if url_key:
                cross_newsletter_projects[entity_id].update(
                    newsletter_projects_by_url.get(url_key, set())
                )

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
    max_engagement_total = max(engagement_totals.values(), default=0.0)
    max_cross_newsletter_count = max(
        (len(project_ids) for project_ids in cross_newsletter_projects.values()),
        default=0,
    )
    max_duplicate_count = max(duplicate_totals.values(), default=0)
    max_abs_feedback = max(
        (abs(value) for value in feedback_totals.values()), default=0.0
    )

    entity_rows = [(_require_pk(entity), entity) for entity in entities]
    entity_updates = []
    snapshots = []
    snapshot_history = {
        entity_pk: list(
            EntityAuthoritySnapshot.objects.filter(entity=entity)
            .order_by("-computed_at")
            .only("computed_at", "final_score")
        )
        for entity_pk, entity in entity_rows
    }

    with transaction.atomic():
        for entity_pk, entity in entity_rows:
            mention_component = _normalize_log_scaled_component(
                mention_counts.get(entity_pk, 0),
                max_mention_count,
            )
            engagement_component = _normalize_log_scaled_component(
                engagement_totals.get(entity_pk, 0.0),
                max_engagement_total,
            )
            recency_component = _average_component(
                total=recency_sums.get(entity_pk, 0.0),
                count=recency_counts.get(entity_pk, 0),
            )
            source_quality_component = _average_component(
                total=source_quality_sums.get(entity_pk, 0.0),
                count=source_quality_counts.get(entity_pk, 0),
            )
            cross_newsletter_component = _normalize_log_scaled_component(
                len(cross_newsletter_projects.get(entity_pk, set())),
                max_cross_newsletter_count,
            )
            feedback_component = _normalize_signed_component(
                feedback_totals.get(entity_pk, 0.0),
                max_abs_feedback,
            )
            duplicate_component = _normalize_log_scaled_component(
                duplicate_totals.get(entity_pk, 0),
                max_duplicate_count,
            )
            decayed_prior = _get_decayed_prior_score(
                entity=entity,
                month_start=month_start,
                authority_decay_rate=config.authority_decay_rate,
                snapshot_history=snapshot_history.get(entity_pk, []),
            )
            weighted_signal_score = _clamp_unit_interval(
                mention_component * normalized_weights["mention"]
                + engagement_component * normalized_weights["engagement"]
                + recency_component * normalized_weights["recency"]
                + source_quality_component * normalized_weights["source_quality"]
                + cross_newsletter_component * normalized_weights["cross_newsletter"]
                + feedback_component * normalized_weights["feedback"]
                + duplicate_component * normalized_weights["duplicate"]
            )
            final_score = _clamp_unit_interval(
                decayed_prior + (1.0 - decayed_prior) * weighted_signal_score
            )

            entity.authority_score = final_score
            entity_updates.append(entity)
            snapshots.append(
                EntityAuthoritySnapshot(
                    entity=entity,
                    project=project,
                    mention_component=mention_component,
                    engagement_component=engagement_component,
                    recency_component=recency_component,
                    source_quality_component=source_quality_component,
                    cross_newsletter_component=cross_newsletter_component,
                    feedback_component=feedback_component,
                    duplicate_component=duplicate_component,
                    decayed_prior=decayed_prior,
                    weights_at_compute={
                        **normalized_weights,
                        "decay_rate": _clamp_unit_interval(config.authority_decay_rate),
                    },
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
        skill_result_pk = _require_pk(skill_result)
        if settings.CELERY_TASK_ALWAYS_EAGER:
            run_relevance_scoring_skill(skill_result_pk)
        else:
            _enqueue_task(run_relevance_scoring_skill, skill_result_pk)
    elif skill_name == SUMMARIZATION_SKILL_NAME:
        skill_result_pk = _require_pk(skill_result)
        if settings.CELERY_TASK_ALWAYS_EAGER:
            run_summarization_skill(skill_result_pk)
        else:
            _enqueue_task(run_summarization_skill, skill_result_pk)
    else:
        raise ValueError(f"Unsupported async skill name: {skill_name}")

    skill_result.refresh_from_db()
    return skill_result


def _normalize_log_scaled_component(value: float, max_value: float) -> float:
    """Normalize a non-negative signal into the authority component range [0, 1]."""

    if max_value <= 0:
        return 0.0
    return _clamp_unit_interval(math.log1p(max(value, 0.0)) / math.log1p(max_value))


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


def _average_component(*, total: float, count: int) -> float:
    """Return the mean component value for a non-empty component population."""

    if count <= 0:
        return 0.0
    return _clamp_unit_interval(total / count)


def _normalized_authority_weights(config: ProjectConfig) -> dict[str, float]:
    """Normalize configured authority weights to a stable sum of 1.0."""

    raw_weights = {
        "mention": max(0.0, float(config.authority_weight_mention or 0.0)),
        "engagement": max(0.0, float(config.authority_weight_engagement or 0.0)),
        "recency": max(0.0, float(config.authority_weight_recency or 0.0)),
        "source_quality": max(
            0.0,
            float(config.authority_weight_source_quality or 0.0),
        ),
        "cross_newsletter": max(
            0.0,
            float(config.authority_weight_cross_newsletter or 0.0),
        ),
        "feedback": max(0.0, float(config.authority_weight_feedback or 0.0)),
        "duplicate": max(0.0, float(config.authority_weight_duplicate or 0.0)),
    }
    total_weight = sum(raw_weights.values())
    if total_weight <= 0:
        return {
            "mention": 1 / 7,
            "engagement": 1 / 7,
            "recency": 1 / 7,
            "source_quality": 1 / 7,
            "cross_newsletter": 1 / 7,
            "feedback": 1 / 7,
            "duplicate": 1 / 7,
        }
    return {
        name: _clamp_unit_interval(weight / total_weight)
        for name, weight in raw_weights.items()
    }


def _author_entities_for_contents(contents: list[Content]) -> dict[int, int | None]:
    """Resolve one best-effort author entity bucket per content row."""

    content_ids = [_require_pk(content) for content in contents]
    if not content_ids:
        return {}
    author_mentions: dict[int, int] = {}
    for content_id, entity_id in (
        EntityMention.objects.filter(
            content_id__in=content_ids,
            role=EntityMentionRole.AUTHOR,
        )
        .order_by("content_id", "entity_id")
        .values_list("content_id", "entity_id")
    ):
        author_mentions.setdefault(int(content_id), int(entity_id))
    return {
        _require_pk(content): author_mentions.get(_require_pk(content))
        or (_require_pk(content.entity) if content.entity is not None else None)
        for content in contents
    }


def _compute_source_quality_scores(
    *, contents: list[Content], author_entity_ids: dict[int, int | None]
) -> dict[str, float]:
    """Compute the current source-quality score for each recent source bucket."""

    if not contents:
        return {}
    authority_scores = {
        int(entity_id): float(authority_score or 0.0)
        for entity_id, authority_score in Entity.objects.filter(
            pk__in=[entity_id for entity_id in author_entity_ids.values() if entity_id]
        ).values_list("id", "authority_score")
    }
    source_counts: dict[str, int] = defaultdict(int)
    source_authority_inputs: dict[str, list[float]] = defaultdict(list)
    for content in contents:
        content_id = _require_pk(content)
        source_key = _authority_source_bucket_key(content)
        source_counts[source_key] += 1
        author_entity_id = author_entity_ids.get(content_id)
        if author_entity_id is None:
            continue
        source_authority_inputs[source_key].append(
            authority_scores.get(author_entity_id, 0.0)
        )

    total_count = sum(source_counts.values())
    source_scores: dict[str, float] = {}
    for source_key, count in source_counts.items():
        authority_values = source_authority_inputs.get(source_key, [])
        mean_authority = (
            sum(authority_values) / len(authority_values) if authority_values else 0.0
        )
        diversity_factor = 0.0
        if total_count > 0:
            diversity_factor = _clamp_unit_interval(1.0 - (count / total_count))
        source_scores[source_key] = _clamp_unit_interval(
            mean_authority * diversity_factor
        )
    return source_scores


def _newsletter_projects_by_url(
    *, contents: list[Content], window_start
) -> dict[str, set[int]]:
    """Return distinct newsletter project sets keyed by canonical URL or raw URL."""

    url_keys = {_content_url_key(content) for content in contents}
    url_keys.discard("")
    if not url_keys:
        return {}
    newsletter_projects: dict[str, set[int]] = defaultdict(set)
    matching_newsletter_contents = Content.objects.filter(
        source_plugin="newsletter",
        published_date__gte=window_start,
    ).filter(Q(canonical_url__in=url_keys) | Q(url__in=url_keys))
    for project_id, canonical_url, url in matching_newsletter_contents.values_list(
        "project_id",
        "canonical_url",
        "url",
    ):
        url_key = str(canonical_url or url or "").strip()
        if not url_key:
            continue
        newsletter_projects[url_key].add(int(project_id))
    return newsletter_projects


def _engagement_total_for_content(
    content: Content,
    newsletter_projects_by_url: dict[str, set[int]],
) -> float:
    """Return the platform-native engagement score captured for one content row."""

    metadata = content.source_metadata or {}
    if content.source_plugin == "linkedin":
        return (
            _metadata_number(metadata.get("like_count"))
            + _metadata_number(metadata.get("comment_count"))
            + _metadata_number(metadata.get("share_count"))
        )
    if content.source_plugin == "bluesky":
        return (
            _metadata_number(metadata.get("like_count"))
            + _metadata_number(metadata.get("reply_count"))
            + _metadata_number(metadata.get("repost_count"))
        )
    if content.source_plugin == "reddit":
        return _metadata_number(metadata.get("score"))
    if content.source_plugin == "mastodon":
        return (
            _metadata_number(metadata.get("favorite_count"))
            + _metadata_number(metadata.get("reply_count"))
            + _metadata_number(metadata.get("reblog_count"))
        )
    if content.source_plugin == "newsletter":
        url_key = _content_url_key(content)
        return float(len(newsletter_projects_by_url.get(url_key, set())))
    return 0.0


def _recency_weight_for_content(content: Content, *, now) -> float:
    """Return the exponentially decayed recency weight for one content row."""

    age_delta = now - content.published_date
    age_days = max(age_delta.total_seconds(), 0.0) / 86400.0
    return _clamp_unit_interval(math.exp(-age_days / AUTHORITY_RECENCY_HALF_LIFE_DAYS))


def _authority_source_bucket_key(content: Content) -> str:
    """Return the source bucket key used for authority source-quality scoring."""

    source_metadata = content.source_metadata or {}
    source_config_id = source_metadata.get("source_config_id")
    if isinstance(source_config_id, bool):
        source_config_id = None
    if isinstance(source_config_id, (int, str)) and source_config_id != "":
        try:
            return f"source_config:{int(source_config_id)}"
        except ValueError:
            pass
    sender_email = str(source_metadata.get("sender_email", "")).strip().lower()
    if sender_email:
        return f"sender_email:{sender_email}"
    for metadata_key in (
        "feed_url",
        "subreddit",
        "author_handle",
        "account_acct",
        "instance_url",
        "author_profile_url",
        "author_urn",
    ):
        metadata_value = str(source_metadata.get(metadata_key, "")).strip().lower()
        if metadata_value:
            return f"{metadata_key}:{metadata_value}"
    if content.source_plugin:
        return f"plugin:{content.source_plugin}"
    return "unknown"


def _content_url_key(content: Content) -> str:
    """Return the normalized URL key used for cross-newsletter corroboration."""

    return str(content.canonical_url or content.url or "").strip()


def _metadata_number(value: object) -> float:
    """Coerce metadata numbers into non-negative floats."""

    if isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        return max(0.0, float(value))
    if isinstance(value, str):
        try:
            return max(0.0, float(value))
        except ValueError:
            return 0.0
    return 0.0


def _clamp_unit_interval(value: float) -> float:
    """Clamp a floating-point score into the inclusive [0, 1] range."""

    return max(0.0, min(1.0, float(value)))


def _schedule_content_processing(content: Content) -> None:
    """Ensure a content row is embedded before it enters the AI pipeline."""

    upsert_content_embedding(content)
    content_pk = _require_pk(content)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        process_content(content_pk)
    else:
        _enqueue_task(process_content, content_pk)
