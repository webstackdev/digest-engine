"""Celery tasks and helpers for trends-domain centroid recomputation."""

import math
from datetime import datetime, timedelta
from typing import Protocol, cast

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db.models import Model
from django.utils import timezone

from core.embeddings import (
    build_content_embedding_text,
    delete_topic_centroid,
    embed_text,
    upsert_topic_centroid,
)
from core.models import FeedbackType, UserFeedback
from projects.models import Project

from .models import TopicCentroidSnapshot

TOPIC_CENTROID_LOOKBACK_DAYS = 90
TOPIC_CENTROID_MIN_UPVOTES = 10
TOPIC_CENTROID_DOWNVOTE_WEIGHT = 0.25
TOPIC_CENTROID_DEBOUNCE_SECONDS = 60 * 5
TOPIC_CENTROID_DECAY_TAU_DAYS = 45


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


@shared_task(name="core.tasks.run_all_topic_centroid_recomputations")
def run_all_topic_centroid_recomputations() -> int:
    """Queue topic-centroid recomputation for every project."""

    project_ids = list(Project.objects.values_list("id", flat=True))
    for project_id in project_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            recompute_topic_centroid(project_id)
        else:
            _enqueue_task(recompute_topic_centroid, project_id)
    return len(project_ids)


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
            content_pk = _require_pk(feedback.content)
            vector = vector_cache.get(content_pk)
            if vector is None:
                vector = embed_text(build_content_embedding_text(feedback.content))
                vector_cache[content_pk] = vector
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
        _enqueue_task(recompute_topic_centroid, project_id)
    return True


def _feedback_decay_weight(created_at: datetime, now: datetime) -> float:
    """Return the EMA-style decay weight for one feedback event."""

    age_days = max(0.0, (now - created_at).total_seconds() / 86400)
    return math.exp(-age_days / TOPIC_CENTROID_DECAY_TAU_DAYS)


def _create_topic_centroid_snapshot(
    *,
    project_id: int,
    computed_at: datetime,
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
