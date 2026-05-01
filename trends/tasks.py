"""Celery tasks and helpers for trends-domain centroid and cluster recomputation."""

from collections import Counter
import math
from datetime import datetime, timedelta
from typing import Any, Protocol, cast

from celery import shared_task
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Model, OuterRef, Prefetch, Subquery
from django.utils import timezone

from core.embeddings import (
    build_content_embedding_text,
    delete_topic_centroid,
    embed_text,
    upsert_topic_centroid,
)
from core.llm import build_skill_user_prompt, get_skill_definition, openrouter_chat_json
from content.models import Content, FeedbackType, UserFeedback
from entities.models import Entity, EntityMention
from projects.models import Project

from .models import (
    ContentClusterMembership,
    ThemeSuggestion,
    ThemeSuggestionStatus,
    TopicCentroidSnapshot,
    TopicCluster,
    TopicVelocitySnapshot,
)

TOPIC_CENTROID_LOOKBACK_DAYS = 90
TOPIC_CENTROID_MIN_UPVOTES = 10
TOPIC_CENTROID_DOWNVOTE_WEIGHT = 0.25
TOPIC_CENTROID_DEBOUNCE_SECONDS = 60 * 5
TOPIC_CENTROID_DECAY_TAU_DAYS = 45
TOPIC_CLUSTER_LOOKBACK_DAYS = 14
TOPIC_CLUSTER_SIMILARITY_THRESHOLD = 0.85
TOPIC_CLUSTER_MIN_MEMBERS = 3
TOPIC_VELOCITY_TRAILING_DAYS = 7
TOPIC_VELOCITY_EMA_ALPHA = 0.5
THEME_DETECTION_SKILL_NAME = "theme_detection"
THEME_SUGGESTION_DAILY_CAP = 5
THEME_NOVELTY_LOOKBACK_DAYS = 30
THEME_NOVELTY_MIN_SCORE = 0.6
THEME_CLUSTER_CONTEXT_LIMIT = 5


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


@shared_task(name="core.tasks.run_all_topic_cluster_recomputations")
def run_all_topic_cluster_recomputations() -> int:
    """Queue topic-cluster recomputation for every project."""

    project_ids = list(Project.objects.values_list("id", flat=True))
    for project_id in project_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            recompute_topic_clusters(project_id)
        else:
            _enqueue_task(recompute_topic_clusters, project_id)
    return len(project_ids)


@shared_task(name="core.tasks.recompute_topic_clusters")
def recompute_topic_clusters(project_id: int) -> dict[str, int]:
    """Rebuild recent topic clusters for one project from active content."""

    now = timezone.now()
    window_start = now - timedelta(days=TOPIC_CLUSTER_LOOKBACK_DAYS)
    recent_contents = list(
        Content.objects.filter(
            project_id=project_id,
            is_active=True,
            published_date__gte=window_start,
        )
        .select_related("entity")
        .only(
            "id",
            "project_id",
            "title",
            "content_text",
            "published_date",
            "entity_id",
        )
        .order_by("published_date", "id")
    )
    vector_cache: dict[int, list[float]] = {}
    cluster_groups = _build_cluster_groups(recent_contents, vector_cache)
    clusters_updated = _sync_topic_clusters(project_id, cluster_groups)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        recompute_topic_velocity(project_id)
    else:
        _enqueue_task(recompute_topic_velocity, project_id)
    return {
        "project_id": project_id,
        "contents_considered": len(recent_contents),
        "clusters_updated": clusters_updated,
    }


@shared_task(name="core.tasks.recompute_topic_velocity")
def recompute_topic_velocity(project_id: int) -> dict[str, int]:
    """Persist one fresh velocity snapshot for each active project cluster."""

    computed_at = timezone.now()
    clusters = list(
        TopicCluster.objects.filter(
            project_id=project_id,
            is_active=True,
            member_count__gte=TOPIC_CLUSTER_MIN_MEMBERS,
        )
        .prefetch_related("memberships__content", "velocity_snapshots")
        .order_by("id")
    )
    snapshot_count = 0
    for cluster in clusters:
        memberships = list(
            ContentClusterMembership.objects.filter(cluster=cluster).select_related(
                "content"
            )
        )
        published_dates = [
            membership.content.published_date
            for membership in memberships
            if membership.content.published_date is not None
        ]
        if len(published_dates) < TOPIC_CLUSTER_MIN_MEMBERS:
            continue
        window_count = _count_within_window(
            published_dates,
            start=computed_at - timedelta(days=1),
            end=computed_at,
        )
        trailing_counts = [
            _count_within_window(
                published_dates,
                start=computed_at - timedelta(days=offset + 1),
                end=computed_at - timedelta(days=offset),
            )
            for offset in range(1, TOPIC_VELOCITY_TRAILING_DAYS + 1)
        ]
        trailing_mean = sum(trailing_counts) / len(trailing_counts)
        trailing_stddev = _population_stddev(trailing_counts, trailing_mean)
        z_score = _capped_z_score(window_count, trailing_mean, trailing_stddev)
        normalized_score = (z_score + 3.0) / 6.0
        previous_snapshot = (
            TopicVelocitySnapshot.objects.filter(cluster=cluster)
            .order_by("-computed_at")
            .first()
        )
        velocity_score = _smooth_velocity_score(
            normalized_score,
            previous_snapshot.velocity_score if previous_snapshot is not None else None,
        )
        _create_topic_velocity_snapshot(
            cluster=cluster,
            computed_at=computed_at,
            window_count=window_count,
            trailing_mean=trailing_mean,
            trailing_stddev=trailing_stddev,
            z_score=z_score,
            velocity_score=velocity_score,
        )
        snapshot_count += 1
    if settings.CELERY_TASK_ALWAYS_EAGER:
        generate_theme_suggestions(project_id)
    else:
        _enqueue_task(generate_theme_suggestions, project_id)
    return {
        "project_id": project_id,
        "clusters_evaluated": len(clusters),
        "snapshots_created": snapshot_count,
    }


@shared_task(name="core.tasks.generate_theme_suggestions")
def generate_theme_suggestions(project_id: int) -> dict[str, int]:
    """Generate pending editor-facing theme suggestions for one project."""

    now = timezone.now()
    clusters = list(_clusters_with_latest_velocity(project_id))
    accepted_history = list(
        ThemeSuggestion.objects.filter(
            project_id=project_id,
            status=ThemeSuggestionStatus.ACCEPTED,
            created_at__gte=now - timedelta(days=THEME_NOVELTY_LOOKBACK_DAYS),
        )
        .only("title", "pitch", "why_it_matters")
        .order_by("-created_at")
    )
    created_today = ThemeSuggestion.objects.filter(
        project_id=project_id,
        status=ThemeSuggestionStatus.PENDING,
        created_at__date=now.date(),
    ).count()
    remaining_slots = max(0, THEME_SUGGESTION_DAILY_CAP - created_today)
    created_count = 0
    updated_count = 0
    skipped_count = 0

    for cluster in clusters:
        latest_velocity = float(getattr(cluster, "velocity_score", 0.0) or 0.0)
        existing_pending = (
            ThemeSuggestion.objects.filter(
                project_id=project_id,
                cluster=cluster,
                status=ThemeSuggestionStatus.PENDING,
            )
            .order_by("-created_at")
            .first()
        )
        if existing_pending is not None:
            existing_pending.velocity_at_creation = latest_velocity
            existing_pending.save(update_fields=["velocity_at_creation"])
            updated_count += 1
            continue
        if remaining_slots <= 0:
            skipped_count += 1
            continue

        cluster_context = _build_theme_cluster_context(cluster)
        theme_payload = _synthesize_theme_payload(
            cluster=cluster,
            cluster_context=cluster_context,
        )
        novelty_score = _score_theme_novelty(
            project=cluster.project,
            theme_payload=theme_payload,
            recent_accepted_themes=accepted_history,
        )
        if novelty_score < THEME_NOVELTY_MIN_SCORE:
            skipped_count += 1
            continue

        ThemeSuggestion.objects.create(
            project_id=project_id,
            cluster=cluster,
            title=str(theme_payload["title"]),
            pitch=str(theme_payload["one_sentence_pitch"]),
            why_it_matters=str(theme_payload["why_it_matters"]),
            suggested_angle=str(theme_payload.get("suggested_angle", "")),
            velocity_at_creation=latest_velocity,
            novelty_score=novelty_score,
        )
        created_count += 1
        remaining_slots -= 1

    return {
        "project_id": project_id,
        "clusters_considered": len(clusters),
        "created": created_count,
        "updated": updated_count,
        "skipped": skipped_count,
    }


@shared_task(name="core.tasks.assign_content_to_topic_cluster")
def assign_content_to_topic_cluster(content_id: int) -> dict[str, object]:
    """Assign one content item to the nearest active cluster when it fits."""

    content = (
        Content.objects.filter(pk=content_id)
        .select_related("entity")
        .only(
            "id",
            "project_id",
            "title",
            "content_text",
            "published_date",
            "entity_id",
            "is_active",
        )
        .first()
    )
    if content is None:
        return {"content_id": content_id, "assigned": False, "reason": "missing"}

    project_id = _require_pk(content.project)
    content_pk = _require_pk(content)

    memberships = ContentClusterMembership.objects.filter(
        project_id=project_id,
        content_id=content_pk,
    )
    if not content.is_active or content.published_date < timezone.now() - timedelta(
        days=TOPIC_CLUSTER_LOOKBACK_DAYS
    ):
        removed_cluster_ids = list(memberships.values_list("cluster_id", flat=True))
        memberships.delete()
        for cluster_id in removed_cluster_ids:
            _refresh_cluster_rollup(cluster_id)
        return {"content_id": content_id, "assigned": False, "reason": "outside_window"}

    active_clusters = list(
        TopicCluster.objects.filter(project_id=project_id, is_active=True)
        .prefetch_related("memberships__content")
        .only(
            "id",
            "project_id",
            "first_seen_at",
            "last_seen_at",
            "is_active",
            "member_count",
            "dominant_entity_id",
        )
    )
    if not active_clusters:
        return {"content_id": content_id, "assigned": False, "reason": "no_clusters"}

    vector_cache: dict[int, list[float]] = {}
    content_vector = _content_vector(content, vector_cache)
    memberships_by_cluster: dict[int, list[ContentClusterMembership]] = {}
    for membership in ContentClusterMembership.objects.filter(
        cluster__in=active_clusters
    ).select_related("content"):
        memberships_by_cluster.setdefault(_require_pk(membership.cluster), []).append(
            membership
        )
    best_cluster: TopicCluster | None = None
    best_similarity = -1.0
    for cluster in active_clusters:
        cluster_pk = _require_pk(cluster)
        member_contents = [
            membership.content
            for membership in memberships_by_cluster.get(cluster_pk, [])
            if _require_pk(membership.content) != content_pk
        ]
        centroid_vector = _cluster_centroid_for_contents(member_contents, vector_cache)
        if not centroid_vector:
            continue
        similarity = _cosine_similarity(content_vector, centroid_vector)
        if similarity > best_similarity:
            best_similarity = similarity
            best_cluster = cluster

    removed_cluster_ids = list(memberships.values_list("cluster_id", flat=True))
    memberships.delete()
    if best_cluster is None or best_similarity < TOPIC_CLUSTER_SIMILARITY_THRESHOLD:
        for cluster_id in removed_cluster_ids:
            _refresh_cluster_rollup(cluster_id)
        return {
            "content_id": content_id,
            "assigned": False,
            "similarity": best_similarity,
        }

    ContentClusterMembership.objects.create(
        content=content,
        cluster=best_cluster,
        project_id=project_id,
        similarity=best_similarity,
    )
    cluster_ids_to_refresh = set(removed_cluster_ids)
    best_cluster_pk = _require_pk(best_cluster)
    cluster_ids_to_refresh.add(best_cluster_pk)
    for cluster_id in cluster_ids_to_refresh:
        _refresh_cluster_rollup(cluster_id)
    return {
        "content_id": content_id,
        "assigned": True,
        "cluster_id": best_cluster_pk,
        "similarity": best_similarity,
    }


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


def _build_cluster_groups(
    contents: list[Content],
    vector_cache: dict[int, list[float]],
) -> list[dict[str, object]]:
    """Group recent contents into provisional clusters by centroid similarity."""

    groups: list[dict[str, object]] = []
    for content in contents:
        content_vector = _content_vector(content, vector_cache)
        best_group: dict[str, object] | None = None
        best_similarity = -1.0
        for group in groups:
            similarity = _cosine_similarity(
                content_vector,
                cast(list[float], group["centroid_vector"]),
            )
            if similarity > best_similarity:
                best_similarity = similarity
                best_group = group
        if best_group is None or best_similarity < TOPIC_CLUSTER_SIMILARITY_THRESHOLD:
            groups.append(
                {
                    "contents": [content],
                    "centroid_vector": content_vector,
                }
            )
            continue
        cast(list[Content], best_group["contents"]).append(content)
        best_group["centroid_vector"] = _cluster_centroid_for_contents(
            cast(list[Content], best_group["contents"]),
            vector_cache,
        )

    return [
        group
        for group in groups
        if len(cast(list[Content], group["contents"])) >= TOPIC_CLUSTER_MIN_MEMBERS
    ]


def _sync_topic_clusters(
    project_id: int,
    cluster_groups: list[dict[str, object]],
) -> int:
    """Persist the current cluster rebuild and retire stale active clusters."""

    existing_clusters = list(
        TopicCluster.objects.filter(project_id=project_id).order_by("id")
    )
    existing_memberships: dict[int, set[int]] = {
        _require_pk(cluster): set() for cluster in existing_clusters
    }
    for cluster_id, content_id in ContentClusterMembership.objects.filter(
        cluster__in=existing_clusters
    ).values_list("cluster_id", "content_id"):
        existing_memberships.setdefault(int(cluster_id), set()).add(int(content_id))
    matched_cluster_ids: set[int] = set()
    clusters_updated = 0

    with transaction.atomic():
        for group in cluster_groups:
            contents = cast(list[Content], group["contents"])
            member_ids = {_require_pk(content) for content in contents}
            cluster = _match_existing_cluster(
                existing_clusters,
                existing_memberships,
                member_ids,
                matched_cluster_ids,
            )
            if cluster is None:
                cluster = TopicCluster.objects.create(
                    project_id=project_id,
                    first_seen_at=min(content.published_date for content in contents),
                    last_seen_at=max(content.published_date for content in contents),
                    is_active=True,
                    member_count=len(contents),
                    dominant_entity=_resolve_dominant_entity(contents),
                )
                existing_clusters.append(cluster)
            else:
                matched_cluster_ids.add(_require_pk(cluster))
                cluster.first_seen_at = min(
                    cluster.first_seen_at,
                    min(content.published_date for content in contents),
                )
                cluster.last_seen_at = max(
                    content.published_date for content in contents
                )
                cluster.is_active = True
                cluster.member_count = len(contents)
                cluster.dominant_entity = _resolve_dominant_entity(contents)
                cluster.save(
                    update_fields=[
                        "first_seen_at",
                        "last_seen_at",
                        "is_active",
                        "member_count",
                        "dominant_entity",
                    ]
                )

            matched_cluster_ids.add(_require_pk(cluster))
            ContentClusterMembership.objects.filter(cluster=cluster).delete()
            centroid_vector = _cluster_centroid_for_contents(contents, {})
            ContentClusterMembership.objects.bulk_create(
                [
                    ContentClusterMembership(
                        content=content,
                        cluster=cluster,
                        project_id=project_id,
                        similarity=_cosine_similarity(
                            _content_vector(content, {}),
                            centroid_vector,
                        ),
                    )
                    for content in contents
                ]
            )
            clusters_updated += 1

        for cluster in existing_clusters:
            if _require_pk(cluster) in matched_cluster_ids:
                continue
            ContentClusterMembership.objects.filter(cluster=cluster).delete()
            if cluster.is_active or cluster.member_count != 0:
                cluster.is_active = False
                cluster.member_count = 0
                cluster.dominant_entity = None
                cluster.save(
                    update_fields=["is_active", "member_count", "dominant_entity"]
                )

    return clusters_updated


def _match_existing_cluster(
    existing_clusters: list[TopicCluster],
    existing_memberships: dict[int, set[int]],
    member_ids: set[int],
    matched_cluster_ids: set[int],
) -> TopicCluster | None:
    """Reuse the existing cluster with the strongest member overlap."""

    best_cluster: TopicCluster | None = None
    best_overlap_count = 0
    best_overlap_ratio = 0.0
    for cluster in existing_clusters:
        cluster_id = _require_pk(cluster)
        if cluster_id in matched_cluster_ids:
            continue
        prior_member_ids = existing_memberships.get(cluster_id, set())
        overlap_count = len(prior_member_ids & member_ids)
        if overlap_count <= 0:
            continue
        overlap_ratio = overlap_count / len(prior_member_ids | member_ids)
        if overlap_count > best_overlap_count or (
            overlap_count == best_overlap_count and overlap_ratio > best_overlap_ratio
        ):
            best_cluster = cluster
            best_overlap_count = overlap_count
            best_overlap_ratio = overlap_ratio
    return best_cluster


def _refresh_cluster_rollup(cluster_id: int) -> None:
    """Refresh member counts and dominant entity after one incremental update."""

    cluster = TopicCluster.objects.filter(pk=cluster_id).first()
    if cluster is None:
        return
    memberships = list(
        ContentClusterMembership.objects.filter(cluster_id=cluster_id)
        .select_related("content", "content__entity")
        .order_by("content__published_date", "content_id")
    )
    if not memberships:
        cluster.is_active = False
        cluster.member_count = 0
        cluster.dominant_entity = None
        cluster.save(update_fields=["is_active", "member_count", "dominant_entity"])
        return

    contents = [membership.content for membership in memberships]
    cluster.is_active = True
    cluster.member_count = len(contents)
    cluster.last_seen_at = max(content.published_date for content in contents)
    cluster.first_seen_at = min(
        cluster.first_seen_at, min(content.published_date for content in contents)
    )
    cluster.dominant_entity = _resolve_dominant_entity(contents)
    cluster.save(
        update_fields=[
            "is_active",
            "member_count",
            "last_seen_at",
            "first_seen_at",
            "dominant_entity",
        ]
    )


def accept_theme_suggestion(
    theme_suggestion: ThemeSuggestion, *, user_id: int
) -> ThemeSuggestion:
    """Mark a pending theme suggestion as accepted."""

    if theme_suggestion.status != ThemeSuggestionStatus.PENDING:
        raise ValueError("Only pending theme suggestions can be accepted.")
    accepted_at = timezone.now()
    with transaction.atomic():
        theme_suggestion.status = ThemeSuggestionStatus.ACCEPTED
        theme_suggestion.decided_at = accepted_at
        theme_suggestion.decided_by = get_user_model()._default_manager.get(pk=user_id)
        theme_suggestion.dismissal_reason = ""
        theme_suggestion.save(
            update_fields=["status", "decided_at", "decided_by", "dismissal_reason"]
        )
        cluster = theme_suggestion.cluster
        project_id = _require_pk(theme_suggestion.project)
        if cluster is not None:
            cluster_id = _require_pk(cluster)
            promoted_content_ids = list(
                ContentClusterMembership.objects.filter(
                    project_id=project_id,
                    cluster_id=cluster_id,
                ).values_list("content_id", flat=True)
            )
            if promoted_content_ids:
                Content.objects.filter(
                    project_id=project_id,
                    id__in=promoted_content_ids,
                ).update(
                    newsletter_promotion_at=accepted_at,
                    newsletter_promotion_by_id=user_id,
                    newsletter_promotion_theme=theme_suggestion,
                )
    return theme_suggestion


def dismiss_theme_suggestion(
    theme_suggestion: ThemeSuggestion,
    *,
    user_id: int,
    reason: str,
) -> ThemeSuggestion:
    """Mark a pending theme suggestion as dismissed with editorial feedback."""

    if theme_suggestion.status != ThemeSuggestionStatus.PENDING:
        raise ValueError("Only pending theme suggestions can be dismissed.")
    theme_suggestion.status = ThemeSuggestionStatus.DISMISSED
    theme_suggestion.decided_at = timezone.now()
    theme_suggestion.decided_by = get_user_model()._default_manager.get(pk=user_id)
    theme_suggestion.dismissal_reason = reason.strip()
    theme_suggestion.save(
        update_fields=["status", "decided_at", "decided_by", "dismissal_reason"]
    )
    return theme_suggestion


def _resolve_dominant_entity(contents: list[Content]) -> Entity | None:
    """Return the most frequently referenced entity across clustered content."""

    if not contents:
        return None
    content_ids = [_require_pk(content) for content in contents]
    entity_counts: Counter[int] = Counter(
        _require_pk(content.entity)
        for content in contents
        if content.entity is not None
    )
    entity_counts.update(
        entity_id
        for entity_id in EntityMention.objects.filter(
            content_id__in=content_ids
        ).values_list("entity_id", flat=True)
    )
    if not entity_counts:
        return None
    dominant_entity_id, _ = max(
        entity_counts.items(), key=lambda item: (item[1], -item[0])
    )
    return Entity.objects.filter(pk=dominant_entity_id).first()


def _clusters_with_latest_velocity(project_id: int):
    """Return active clusters annotated with their latest velocity metrics."""

    latest_snapshot_queryset = TopicVelocitySnapshot.objects.filter(
        cluster_id=OuterRef("pk")
    ).order_by("-computed_at")
    return (
        TopicCluster.objects.filter(
            project_id=project_id,
            is_active=True,
            member_count__gte=TOPIC_CLUSTER_MIN_MEMBERS,
        )
        .select_related("project", "dominant_entity")
        .annotate(
            velocity_score=Subquery(
                latest_snapshot_queryset.values("velocity_score")[:1]
            ),
            z_score=Subquery(latest_snapshot_queryset.values("z_score")[:1]),
        )
        .prefetch_related(
            Prefetch(
                "memberships",
                queryset=ContentClusterMembership.objects.select_related(
                    "content"
                ).order_by("-similarity", "-assigned_at"),
            )
        )
        .order_by("-velocity_score", "-last_seen_at")
    )


def _build_theme_cluster_context(cluster: TopicCluster) -> dict[str, Any]:
    """Serialize the most relevant cluster context for theme generation."""

    memberships = list(
        ContentClusterMembership.objects.filter(cluster=cluster).select_related(
            "content"
        )[:THEME_CLUSTER_CONTEXT_LIMIT]
    )
    recent_feedback = _recent_feedback_signals(
        [_require_pk(membership.content) for membership in memberships]
    )
    cluster_id = _require_pk(cluster)
    dominant_entity = cluster.dominant_entity
    dominant_entity_id = (
        _require_pk(dominant_entity) if dominant_entity is not None else None
    )
    return {
        "cluster_id": cluster_id,
        "dominant_entity": (
            {
                "id": dominant_entity_id,
                "name": dominant_entity.name,
                "type": dominant_entity.type,
            }
            if dominant_entity_id is not None and dominant_entity is not None
            else None
        ),
        "velocity_score": float(getattr(cluster, "velocity_score", 0.0) or 0.0),
        "z_score": float(getattr(cluster, "z_score", 0.0) or 0.0),
        "member_count": cluster.member_count,
        "latest_members": [
            {
                "content_id": _require_pk(membership.content),
                "title": membership.content.title,
                "url": membership.content.url,
                "source_plugin": membership.content.source_plugin,
                "published_date": membership.content.published_date.isoformat(),
                "summary": membership.content.content_text[:400],
                "similarity": membership.similarity,
                "feedback_signals": recent_feedback.get(
                    _require_pk(membership.content), {}
                ),
            }
            for membership in memberships
        ],
    }


def _synthesize_theme_payload(
    *,
    cluster: TopicCluster,
    cluster_context: dict[str, Any],
) -> dict[str, str]:
    """Generate one editor-facing theme suggestion payload."""

    if settings.OPENROUTER_API_KEY:
        try:
            response = openrouter_chat_json(
                model=settings.AI_SUMMARIZATION_MODEL,
                system_prompt=get_skill_definition(
                    THEME_DETECTION_SKILL_NAME
                ).instructions_markdown,
                user_prompt=build_skill_user_prompt(
                    THEME_DETECTION_SKILL_NAME,
                    {
                        "project_topic": cluster.project.topic_description,
                        "cluster_context": cluster_context,
                        "recent_accepted_themes": [],
                    },
                ),
            )
            payload = response.payload
            return {
                "title": str(payload.get("title", "")).strip()
                or _fallback_theme_title(cluster_context),
                "one_sentence_pitch": str(payload.get("one_sentence_pitch", "")).strip()
                or _fallback_theme_pitch(cluster_context),
                "why_it_matters": str(payload.get("why_it_matters", "")).strip()
                or _fallback_theme_why(cluster_context),
                "suggested_angle": str(payload.get("suggested_angle", "")).strip(),
            }
        except Exception:
            pass

    return {
        "title": _fallback_theme_title(cluster_context),
        "one_sentence_pitch": _fallback_theme_pitch(cluster_context),
        "why_it_matters": _fallback_theme_why(cluster_context),
        "suggested_angle": _fallback_theme_angle(cluster_context),
    }


def _score_theme_novelty(
    *,
    project: Project,
    theme_payload: dict[str, str],
    recent_accepted_themes: list[ThemeSuggestion],
) -> float:
    """Estimate how novel a generated theme is versus recent accepted themes."""

    heuristic_score = (
        _heuristic_theme_novelty_score(theme_payload, recent_accepted_themes)
        if recent_accepted_themes
        else 1.0
    )
    if settings.OPENROUTER_API_KEY:
        try:
            response = openrouter_chat_json(
                model=settings.AI_RELEVANCE_MODEL,
                system_prompt=(
                    "Score the novelty of a proposed newsletter theme against recent accepted themes. "
                    "Return JSON with fields novelty_score and explanation. novelty_score must be between 0 and 1, where 1 is highly novel."
                ),
                user_prompt=(
                    f"project_topic:\n{project.topic_description}\n\n"
                    f"candidate_theme:\n{theme_payload}\n\n"
                    f"recent_accepted_themes:\n{[{'title': theme.title, 'pitch': theme.pitch, 'why_it_matters': theme.why_it_matters} for theme in recent_accepted_themes[:10]]}\n\n"
                    "Return only a JSON object with fields novelty_score and explanation."
                ),
            )
            payload = response.payload
            novelty_score = float(payload.get("novelty_score", heuristic_score))
            return max(0.0, min(1.0, novelty_score))
        except Exception:
            pass
    return heuristic_score


def _recent_feedback_signals(content_ids: list[int]) -> dict[int, dict[str, int]]:
    """Summarize recent feedback counts for the supplied content rows."""

    if not content_ids:
        return {}
    feedback_counts: dict[int, dict[str, int]] = {
        content_id: {"upvotes": 0, "downvotes": 0} for content_id in content_ids
    }
    for content_id, feedback_type in UserFeedback.objects.filter(
        content_id__in=content_ids
    ).values_list("content_id", "feedback_type"):
        if feedback_type == FeedbackType.UPVOTE:
            feedback_counts[content_id]["upvotes"] += 1
        elif feedback_type == FeedbackType.DOWNVOTE:
            feedback_counts[content_id]["downvotes"] += 1
    return feedback_counts


def _fallback_theme_title(cluster_context: dict[str, Any]) -> str:
    """Build a deterministic fallback theme title from cluster context."""

    dominant_entity = cluster_context.get("dominant_entity") or {}
    if dominant_entity.get("name"):
        return f"Why {dominant_entity['name']} keeps surfacing right now"
    latest_members = cluster_context.get("latest_members", [])
    if latest_members:
        return str(latest_members[0]["title"])[:255]
    return "Emerging theme"


def _fallback_theme_pitch(cluster_context: dict[str, Any]) -> str:
    """Build a deterministic fallback pitch from cluster velocity context."""

    latest_members = cluster_context.get("latest_members", [])
    if latest_members:
        return (
            f"This cluster is accelerating across {cluster_context.get('member_count', 0)} recent items, "
            f"with '{latest_members[0]['title']}' leading the current signal."
        )
    return "This cluster is accelerating across the project's recent content."


def _fallback_theme_why(cluster_context: dict[str, Any]) -> str:
    """Explain why the fallback theme matters now."""

    return (
        f"The cluster's current velocity score is {cluster_context.get('velocity_score', 0.0):.2f}, "
        f"which indicates a faster-than-baseline increase in related coverage."
    )


def _fallback_theme_angle(cluster_context: dict[str, Any]) -> str:
    """Suggest a deterministic editorial angle when the LLM is unavailable."""

    dominant_entity = cluster_context.get("dominant_entity") or {}
    if dominant_entity.get("name"):
        return f"Explain what changed around {dominant_entity['name']} and why it matters for the project topic."
    return "Identify the common thread across the latest members and explain why it is accelerating now."


def _heuristic_theme_novelty_score(
    theme_payload: dict[str, str],
    recent_accepted_themes: list[ThemeSuggestion],
) -> float:
    """Estimate novelty using simple token overlap with accepted themes."""

    candidate_tokens = _normalized_theme_tokens(
        f"{theme_payload.get('title', '')} {theme_payload.get('one_sentence_pitch', '')}"
    )
    if not candidate_tokens:
        return 0.0
    max_overlap = 0.0
    for theme in recent_accepted_themes:
        prior_tokens = _normalized_theme_tokens(f"{theme.title} {theme.pitch}")
        if not prior_tokens:
            continue
        overlap = len(candidate_tokens & prior_tokens) / len(
            candidate_tokens | prior_tokens
        )
        max_overlap = max(max_overlap, overlap)
    return max(0.0, min(1.0, 1.0 - max_overlap))


def _normalized_theme_tokens(text: str) -> set[str]:
    """Normalize free text into a small token set for novelty heuristics."""

    return {
        token
        for token in "".join(
            char.lower() if char.isalnum() else " " for char in text
        ).split()
        if len(token) > 2
    }


def _content_vector(
    content: Content,
    vector_cache: dict[int, list[float]],
) -> list[float]:
    """Return one content embedding, caching repeated lookups within a task."""

    content_pk = _require_pk(content)
    vector = vector_cache.get(content_pk)
    if vector is not None:
        return vector
    vector = embed_text(build_content_embedding_text(content))
    vector_cache[content_pk] = vector
    return vector


def _cluster_centroid_for_contents(
    contents: list[Content],
    vector_cache: dict[int, list[float]],
) -> list[float]:
    """Average and normalize the content vectors for one cluster."""

    vectors = [_content_vector(content, vector_cache) for content in contents]
    if not vectors:
        return []
    dimension = len(vectors[0])
    mean_vector = [0.0] * dimension
    for vector in vectors:
        for index, value in enumerate(vector):
            mean_vector[index] += float(value)
    return _normalize_vector([value / len(vectors) for value in mean_vector])


def _count_within_window(
    published_dates: list[datetime],
    *,
    start: datetime,
    end: datetime,
) -> int:
    """Count published dates inside one half-open time window."""

    return sum(1 for published_at in published_dates if start <= published_at < end)


def _population_stddev(values: list[int], mean: float) -> float:
    """Return the population standard deviation for integer daily counts."""

    if not values:
        return 0.0
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return math.sqrt(variance)


def _capped_z_score(
    window_count: int, trailing_mean: float, trailing_stddev: float
) -> float:
    """Return the capped z-score for one cluster's latest daily activity."""

    if trailing_stddev <= 0:
        if window_count > trailing_mean:
            return 3.0
        if window_count < trailing_mean:
            return -3.0
        return 0.0
    raw_z_score = (window_count - trailing_mean) / trailing_stddev
    return max(-3.0, min(3.0, raw_z_score))


def _smooth_velocity_score(raw_score: float, previous_score: float | None) -> float:
    """Apply a short EMA so single-day spikes do not dominate ranking."""

    if previous_score is None:
        return raw_score
    return (TOPIC_VELOCITY_EMA_ALPHA * raw_score) + (
        (1.0 - TOPIC_VELOCITY_EMA_ALPHA) * previous_score
    )


def _create_topic_velocity_snapshot(
    *,
    cluster: TopicCluster,
    computed_at: datetime,
    window_count: int,
    trailing_mean: float,
    trailing_stddev: float,
    z_score: float,
    velocity_score: float,
) -> TopicVelocitySnapshot:
    """Persist one velocity snapshot while preserving a controlled timestamp."""

    snapshot = TopicVelocitySnapshot.objects.create(
        cluster=cluster,
        project_id=_require_pk(cluster.project),
        window_count=window_count,
        trailing_mean=trailing_mean,
        trailing_stddev=trailing_stddev,
        z_score=z_score,
        velocity_score=velocity_score,
    )
    if snapshot.computed_at != computed_at:
        TopicVelocitySnapshot.objects.filter(pk=snapshot.pk).update(
            computed_at=computed_at
        )
        snapshot.computed_at = computed_at
    return snapshot


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    """Return cosine similarity between two normalized-compatible vectors."""

    if not left or not right or len(left) != len(right):
        return -1.0
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm <= 0 or right_norm <= 0:
        return -1.0
    cosine_similarity = sum(
        left_value * right_value for left_value, right_value in zip(left, right)
    ) / (left_norm * right_norm)
    return max(-1.0, min(1.0, cosine_similarity))
