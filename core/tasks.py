"""Celery tasks that drive ingestion, AI processing, and newsletter extraction."""

import logging
import math
from collections import defaultdict
from datetime import timedelta
from importlib import import_module
from typing import TYPE_CHECKING, Any, Protocol, cast

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Model
from django.utils import timezone

from core.embeddings import (
    upsert_content_embedding,
)
from core.models import (
    Content,
    FeedbackType,
    UserFeedback,
)
from core.pipeline import (
    RELEVANCE_SKILL_NAME,
    SUMMARIZATION_SKILL_NAME,
    create_pending_skill_result,
    execute_background_skill_result,
    process_content_pipeline,
)
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityMention,
    EntityMentionRole,
)
from projects.models import Project, ProjectConfig

logger = logging.getLogger(__name__)

AUTHORITY_LOOKBACK_DAYS = 90
AUTHORITY_ROLE_SIGNALS = (
    EntityMentionRole.AUTHOR,
    EntityMentionRole.SUBJECT,
)

if TYPE_CHECKING:
    from ingestion.tasks import run_all_ingestions, run_ingestion
    from newsletters.tasks import process_newsletter_intake
    from trends.tasks import (
        TOPIC_CENTROID_MIN_UPVOTES,
        assign_content_to_topic_cluster,
        queue_topic_centroid_recompute,
        recompute_topic_centroid,
        recompute_topic_clusters,
        recompute_topic_velocity,
        run_all_topic_centroid_recomputations,
        run_all_topic_cluster_recomputations,
    )

_COMPAT_TASK_EXPORTS = {
    "process_newsletter_intake": (
        "newsletters.tasks",
        "process_newsletter_intake",
    ),
    "run_all_ingestions": ("ingestion.tasks", "run_all_ingestions"),
    "run_ingestion": ("ingestion.tasks", "run_ingestion"),
    "assign_content_to_topic_cluster": (
        "trends.tasks",
        "assign_content_to_topic_cluster",
    ),
    "TOPIC_CENTROID_MIN_UPVOTES": (
        "trends.tasks",
        "TOPIC_CENTROID_MIN_UPVOTES",
    ),
    "recompute_topic_clusters": ("trends.tasks", "recompute_topic_clusters"),
    "queue_topic_centroid_recompute": (
        "trends.tasks",
        "queue_topic_centroid_recompute",
    ),
    "recompute_topic_centroid": ("trends.tasks", "recompute_topic_centroid"),
    "recompute_topic_velocity": ("trends.tasks", "recompute_topic_velocity"),
    "run_all_topic_cluster_recomputations": (
        "trends.tasks",
        "run_all_topic_cluster_recomputations",
    ),
    "run_all_topic_centroid_recomputations": (
        "trends.tasks",
        "run_all_topic_centroid_recomputations",
    ),
}

__all__ = [
    "process_newsletter_intake",
    "run_all_ingestions",
    "assign_content_to_topic_cluster",
    "run_ingestion",
    "TOPIC_CENTROID_MIN_UPVOTES",
    "queue_topic_centroid_recompute",
    "recompute_authority_scores",
    "recompute_topic_clusters",
    "recompute_topic_centroid",
    "recompute_topic_velocity",
    "run_all_authority_recomputations",
    "run_all_topic_cluster_recomputations",
    "run_all_topic_centroid_recomputations",
    "run_relevance_scoring_skill",
    "run_summarization_skill",
    "queue_content_skill",
    "process_content",
    "upsert_content_embedding",
]


def __getattr__(name: str) -> Any:
    """Resolve compatibility task re-exports lazily."""

    try:
        module_name, attribute_name = _COMPAT_TASK_EXPORTS[name]
    except KeyError as exc:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}") from exc

    value = getattr(import_module(module_name), attribute_name)
    globals()[name] = value
    return value


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


def _schedule_content_processing(content: Content) -> None:
    """Ensure a content row is embedded before it enters the AI pipeline."""

    upsert_content_embedding(content)
    content_pk = _require_pk(content)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        process_content(content_pk)
    else:
        _enqueue_task(process_content, content_pk)
