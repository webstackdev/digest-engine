"""Django Ninja endpoints for project-scoped trends and observability resources."""

from __future__ import annotations

import datetime
from typing import Any, cast
from uuid import UUID

from django.db.models import Avg, Count, OuterRef, Prefetch, Q, Subquery
from ninja import Body, Path, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status

from content.models import Content
from core.ninja_api import api_authenticate
from digest_engine.taskiq import enqueue_task, task_always_eager
from projects.models import Project, ProjectMembership, ProjectRole
from projects.ninja_helpers import _get_project_or_404
from trends.models import (
    ContentClusterMembership,
    OriginalContentIdea,
    SourceDiversitySnapshot,
    ThemeSuggestion,
    TopicCentroidSnapshot,
    TopicCluster,
    TopicVelocitySnapshot,
    TrendTaskRun,
)
from trends.observability import TRACKED_TREND_TASKS
from trends.tasks import (
    accept_original_content_idea,
    accept_theme_suggestion,
    dismiss_original_content_idea,
    dismiss_theme_suggestion,
    generate_original_content_ideas,
    mark_original_content_idea_written,
)

clusters_router = Router(tags=["Trend Analysis"])
themes_router = Router(tags=["Trend Analysis"])
ideas_router = Router(tags=["Trend Analysis"])
topic_centroid_snapshots_router = Router(tags=["Observability"])
source_diversity_snapshots_router = Router(tags=["Observability"])
trend_task_runs_router = Router(tags=["Observability"])


class ErrorResponseSchema(Schema):
    """Simple field-to-message error response payload."""

    message: str


class DismissInputSchema(Schema):
    """Dismissal reason payload for workflow actions."""

    reason: str


class TopicClusterEntitySchema(Schema):
    """Dominant entity summary for one topic cluster."""

    id: int
    name: str
    type: str


class TopicClusterContentSummarySchema(Schema):
    """Content fields surfaced on cluster detail responses."""

    id: int
    url: str
    title: str
    published_date: datetime.datetime
    source_plugin: str


class ContentClusterMembershipSchema(Schema):
    """One content membership inside a topic cluster."""

    id: int
    content: TopicClusterContentSummarySchema
    similarity: float
    assigned_at: datetime.datetime


class TopicVelocitySnapshotSchema(Schema):
    """One persisted topic velocity snapshot."""

    id: int
    cluster: int
    project: int
    computed_at: datetime.datetime
    window_count: int
    trailing_mean: float
    trailing_stddev: float
    z_score: float
    velocity_score: float


class TopicClusterSchema(Schema):
    """One topic cluster with its current velocity rollup."""

    id: int
    project: int
    centroid_vector_id: UUID
    label: str
    first_seen_at: datetime.datetime
    last_seen_at: datetime.datetime
    is_active: bool
    member_count: int
    dominant_entity: TopicClusterEntitySchema | None = None
    velocity_score: float | None = None
    z_score: float | None = None
    window_count: int | None = None
    velocity_computed_at: datetime.datetime | None = None


class TopicClusterDetailSchema(TopicClusterSchema):
    """One topic cluster with memberships and snapshot history."""

    memberships: list[ContentClusterMembershipSchema]
    velocity_history: list[TopicVelocitySnapshotSchema]


class ThemeSuggestionClusterSummarySchema(Schema):
    """Cluster summary embedded in one theme suggestion."""

    id: int
    label: str
    member_count: int
    velocity_score: float | None = None


class ThemeSuggestionPromotedContentSchema(Schema):
    """Content row marked for newsletter promotion by a theme."""

    id: int
    url: str
    title: str
    published_date: datetime.datetime
    source_plugin: str
    newsletter_promotion_at: datetime.datetime | None = None


class ThemeSuggestionSchema(Schema):
    """Editor-facing theme suggestion payload."""

    id: int
    project: int
    cluster: ThemeSuggestionClusterSummarySchema | None = None
    title: str
    pitch: str
    why_it_matters: str
    suggested_angle: str
    velocity_at_creation: float
    novelty_score: float
    status: str
    dismissal_reason: str
    created_at: datetime.datetime
    decided_at: datetime.datetime | None = None
    decided_by: int | None = None
    decided_by_username: str | None = None
    promoted_contents: list[ThemeSuggestionPromotedContentSchema]


class OriginalContentIdeaClusterSummarySchema(Schema):
    """Related cluster summary embedded in one original content idea."""

    id: int
    label: str
    member_count: int


class OriginalContentIdeaSupportingContentSchema(Schema):
    """Supporting content row linked to one original content idea."""

    id: int
    url: str
    title: str
    published_date: datetime.datetime
    source_plugin: str


class OriginalContentIdeaSchema(Schema):
    """Editor-facing original content idea payload."""

    id: int
    project: int
    angle_title: str
    summary: str
    suggested_outline: str
    why_now: str
    supporting_contents: list[OriginalContentIdeaSupportingContentSchema]
    related_cluster: OriginalContentIdeaClusterSummarySchema | None = None
    generated_by_model: str
    self_critique_score: float
    status: str
    dismissal_reason: str
    created_at: datetime.datetime
    decided_at: datetime.datetime | None = None
    decided_by: int | None = None
    decided_by_username: str | None = None


class OriginalContentIdeaGenerateResultSchema(Schema):
    """Immediate generation counts for original content ideas."""

    project_id: int
    clusters_considered: int
    created: int
    skipped: int


class OriginalContentIdeaGenerateCompletedSchema(Schema):
    """Completed original content idea generation response."""

    status: str
    project_id: int
    result: OriginalContentIdeaGenerateResultSchema


class OriginalContentIdeaGenerateQueuedSchema(Schema):
    """Queued original content idea generation response."""

    status: str
    project_id: int


class TopicCentroidSnapshotSchema(Schema):
    """One persisted topic-centroid recomputation for a project."""

    id: int
    project: int
    computed_at: datetime.datetime
    centroid_active: bool
    feedback_count: int
    upvote_count: int
    downvote_count: int
    drift_from_previous: float | None = None
    drift_from_week_ago: float | None = None


class TopicCentroidObservabilitySummarySchema(Schema):
    """Project-level centroid observability summary metrics."""

    project: int
    snapshot_count: int
    active_snapshot_count: int
    avg_drift_from_previous: float | None = None
    avg_drift_from_week_ago: float | None = None
    latest_snapshot: TopicCentroidSnapshotSchema | None = None


class SourceDiversitySnapshotSchema(Schema):
    """One persisted source-diversity snapshot for a project."""

    id: int
    project: int
    computed_at: datetime.datetime
    window_days: int
    plugin_entropy: float
    source_entropy: float
    author_entropy: float
    cluster_entropy: float
    top_plugin_share: float
    top_source_share: float
    breakdown: dict[str, Any]


class SourceDiversityObservabilitySummarySchema(Schema):
    """Project-level source-diversity observability metrics."""

    project: int
    snapshot_count: int
    latest_snapshot: SourceDiversitySnapshotSchema | None = None


class TrendTaskRunSchema(Schema):
    """One persisted trend pipeline task execution."""

    id: int
    project: int
    task_name: str
    task_run_id: UUID
    status: str
    started_at: datetime.datetime
    finished_at: datetime.datetime | None = None
    latency_ms: int | None = None
    error_message: str
    summary: dict[str, Any]


class TrendTaskRunObservabilitySummarySchema(Schema):
    """Latest trend task runs plus project-level rollup counts."""

    project: int
    run_count: int
    failed_run_count: int
    latest_runs: list[TrendTaskRunSchema]


def _require_pk(instance: Any) -> int:
    """Return a saved model primary key for trends API response payloads."""

    instance_pk = getattr(instance, "pk", None)
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _serialize_topic_cluster(cluster: TopicCluster) -> dict[str, Any]:
    """Return one topic-cluster response body."""

    dominant_entity = None
    if cluster.dominant_entity_id is not None and cluster.dominant_entity is not None:
        dominant_entity = {
            "id": cluster.dominant_entity_id,
            "name": cluster.dominant_entity.name,
            "type": cluster.dominant_entity.type,
        }
    return {
        "id": _require_pk(cluster),
        "project": cluster.project_id,
        "centroid_vector_id": cluster.centroid_vector_id,
        "label": cluster.label,
        "first_seen_at": cluster.first_seen_at,
        "last_seen_at": cluster.last_seen_at,
        "is_active": cluster.is_active,
        "member_count": cluster.member_count,
        "dominant_entity": dominant_entity,
        "velocity_score": cast(float | None, getattr(cluster, "velocity_score", None)),
        "z_score": cast(float | None, getattr(cluster, "z_score", None)),
        "window_count": cast(int | None, getattr(cluster, "window_count", None)),
        "velocity_computed_at": cast(
            datetime.datetime | None,
            getattr(cluster, "velocity_computed_at", None),
        ),
    }


def _serialize_membership(membership: ContentClusterMembership) -> dict[str, Any]:
    """Return one content cluster membership response body."""

    return {
        "id": _require_pk(membership),
        "content": {
            "id": membership.content_id,
            "url": membership.content.url,
            "title": membership.content.title,
            "published_date": membership.content.published_date,
            "source_plugin": membership.content.source_plugin,
        },
        "similarity": membership.similarity,
        "assigned_at": membership.assigned_at,
    }


def _serialize_topic_cluster_detail(cluster: TopicCluster) -> dict[str, Any]:
    """Return one detailed topic-cluster response body."""

    payload = _serialize_topic_cluster(cluster)
    payload["memberships"] = [
        _serialize_membership(membership) for membership in cluster.memberships.all()
    ]
    payload["velocity_history"] = [
        _serialize_velocity_snapshot(snapshot)
        for snapshot in cluster.velocity_snapshots.all()
    ]
    return payload


def _serialize_velocity_snapshot(snapshot: TopicVelocitySnapshot) -> dict[str, Any]:
    """Return one topic velocity snapshot response body."""

    return {
        "id": _require_pk(snapshot),
        "cluster": snapshot.cluster_id,
        "project": snapshot.project_id,
        "computed_at": snapshot.computed_at,
        "window_count": snapshot.window_count,
        "trailing_mean": snapshot.trailing_mean,
        "trailing_stddev": snapshot.trailing_stddev,
        "z_score": snapshot.z_score,
        "velocity_score": snapshot.velocity_score,
    }


def _serialize_theme_promoted_content(content: Content) -> dict[str, Any]:
    """Return one promoted-content response body."""

    return {
        "id": _require_pk(content),
        "url": content.url,
        "title": content.title,
        "published_date": content.published_date,
        "source_plugin": content.source_plugin,
        "newsletter_promotion_at": content.newsletter_promotion_at,
    }


def _serialize_theme_suggestion(suggestion: ThemeSuggestion) -> dict[str, Any]:
    """Return one theme suggestion response body."""

    cluster_payload = None
    if suggestion.cluster_id is not None and suggestion.cluster is not None:
        cluster_payload = {
            "id": suggestion.cluster_id,
            "label": suggestion.cluster.label,
            "member_count": suggestion.cluster.member_count,
            "velocity_score": cast(
                float | None,
                getattr(suggestion, "cluster__velocity_score", None),
            ),
        }
    return {
        "id": _require_pk(suggestion),
        "project": suggestion.project_id,
        "cluster": cluster_payload,
        "title": suggestion.title,
        "pitch": suggestion.pitch,
        "why_it_matters": suggestion.why_it_matters,
        "suggested_angle": suggestion.suggested_angle,
        "velocity_at_creation": suggestion.velocity_at_creation,
        "novelty_score": suggestion.novelty_score,
        "status": suggestion.status,
        "dismissal_reason": suggestion.dismissal_reason,
        "created_at": suggestion.created_at,
        "decided_at": suggestion.decided_at,
        "decided_by": suggestion.decided_by_id,
        "decided_by_username": (
            suggestion.decided_by.username if suggestion.decided_by_id else None
        ),
        "promoted_contents": [
            _serialize_theme_promoted_content(content)
            for content in suggestion.promoted_contents.all()
        ],
    }


def _serialize_original_content_supporting_content(content: Content) -> dict[str, Any]:
    """Return one supporting-content response body."""

    return {
        "id": _require_pk(content),
        "url": content.url,
        "title": content.title,
        "published_date": content.published_date,
        "source_plugin": content.source_plugin,
    }


def _serialize_original_content_idea(idea: OriginalContentIdea) -> dict[str, Any]:
    """Return one original content idea response body."""

    related_cluster = None
    if idea.related_cluster_id is not None and idea.related_cluster is not None:
        related_cluster = {
            "id": idea.related_cluster_id,
            "label": idea.related_cluster.label,
            "member_count": idea.related_cluster.member_count,
        }
    return {
        "id": _require_pk(idea),
        "project": idea.project_id,
        "angle_title": idea.angle_title,
        "summary": idea.summary,
        "suggested_outline": idea.suggested_outline,
        "why_now": idea.why_now,
        "supporting_contents": [
            _serialize_original_content_supporting_content(content)
            for content in idea.supporting_contents.all()
        ],
        "related_cluster": related_cluster,
        "generated_by_model": idea.generated_by_model,
        "self_critique_score": idea.self_critique_score,
        "status": idea.status,
        "dismissal_reason": idea.dismissal_reason,
        "created_at": idea.created_at,
        "decided_at": idea.decided_at,
        "decided_by": idea.decided_by_id,
        "decided_by_username": idea.decided_by.username if idea.decided_by_id else None,
    }


def _serialize_topic_centroid_snapshot(
    snapshot: TopicCentroidSnapshot,
) -> dict[str, Any]:
    """Return one topic centroid snapshot response body."""

    return {
        "id": _require_pk(snapshot),
        "project": snapshot.project_id,
        "computed_at": snapshot.computed_at,
        "centroid_active": snapshot.centroid_active,
        "feedback_count": snapshot.feedback_count,
        "upvote_count": snapshot.upvote_count,
        "downvote_count": snapshot.downvote_count,
        "drift_from_previous": snapshot.drift_from_previous,
        "drift_from_week_ago": snapshot.drift_from_week_ago,
    }


def _serialize_source_diversity_snapshot(
    snapshot: SourceDiversitySnapshot,
) -> dict[str, Any]:
    """Return one source diversity snapshot response body."""

    return {
        "id": _require_pk(snapshot),
        "project": snapshot.project_id,
        "computed_at": snapshot.computed_at,
        "window_days": snapshot.window_days,
        "plugin_entropy": snapshot.plugin_entropy,
        "source_entropy": snapshot.source_entropy,
        "author_entropy": snapshot.author_entropy,
        "cluster_entropy": snapshot.cluster_entropy,
        "top_plugin_share": snapshot.top_plugin_share,
        "top_source_share": snapshot.top_source_share,
        "breakdown": snapshot.breakdown,
    }


def _serialize_trend_task_run(run: TrendTaskRun) -> dict[str, Any]:
    """Return one trend task run response body."""

    return {
        "id": _require_pk(run),
        "project": run.project_id,
        "task_name": run.task_name,
        "task_run_id": run.task_run_id,
        "status": run.status,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "latency_ms": run.latency_ms,
        "error_message": run.error_message,
        "summary": run.summary,
    }


def _normalized_reason(reason: str) -> str:
    """Normalize one dismissal reason and reject blank values."""

    normalized = reason.strip()
    if not normalized:
        raise HttpError(400, {"reason": "Dismissal reason cannot be blank."})
    return normalized


def _require_project_member(request: Any, project_id: int) -> Project:
    """Load one project if the current user can read project-scoped trends."""

    return _get_project_or_404(request, project_id)


def _require_project_contributor(request: Any, project_id: int) -> Project:
    """Load one project if the current user can mutate project-scoped trends."""

    project = _get_project_or_404(request, project_id)
    membership = ProjectMembership.objects.filter(
        project=project,
        user=request.user,
    ).first()
    if not membership or membership.role not in {ProjectRole.ADMIN, ProjectRole.MEMBER}:
        raise HttpError(403, "You do not have permission to perform this action.")
    return project


def _topic_cluster_queryset(for_detail: bool = False):
    """Return the canonical annotated queryset for topic clusters."""

    latest_snapshot_queryset = TopicVelocitySnapshot.objects.filter(
        cluster_id=OuterRef("pk")
    ).order_by("-computed_at")
    queryset = TopicCluster.objects.select_related(
        "project", "dominant_entity"
    ).annotate(
        velocity_score=Subquery(latest_snapshot_queryset.values("velocity_score")[:1]),
        z_score=Subquery(latest_snapshot_queryset.values("z_score")[:1]),
        window_count=Subquery(latest_snapshot_queryset.values("window_count")[:1]),
        velocity_computed_at=Subquery(
            latest_snapshot_queryset.values("computed_at")[:1]
        ),
    )
    if for_detail:
        queryset = queryset.prefetch_related(
            Prefetch(
                "memberships",
                queryset=ContentClusterMembership.objects.select_related(
                    "content"
                ).order_by("-similarity", "-assigned_at"),
            ),
            Prefetch(
                "velocity_snapshots",
                queryset=TopicVelocitySnapshot.objects.order_by("-computed_at"),
            ),
        )
    return queryset


def _get_topic_cluster_or_404(
    project_id: int,
    cluster_id: int,
    *,
    for_detail: bool = False,
) -> TopicCluster:
    """Load one topic cluster for the selected project."""

    cluster = (
        _topic_cluster_queryset(for_detail=for_detail)
        .filter(
            project_id=project_id,
            pk=cluster_id,
        )
        .first()
    )
    if not cluster:
        raise HttpError(404, "Not found.")
    return cluster


def _theme_suggestion_queryset():
    """Return the canonical queryset for theme suggestions."""

    latest_snapshot_queryset = TopicVelocitySnapshot.objects.filter(
        cluster_id=OuterRef("cluster_id")
    ).order_by("-computed_at")
    return (
        ThemeSuggestion.objects.select_related("project", "cluster", "decided_by")
        .select_related("cluster__dominant_entity")
        .prefetch_related(
            Prefetch(
                "promoted_contents",
                queryset=Content.objects.order_by(
                    "-newsletter_promotion_at", "-published_date"
                ),
            )
        )
        .annotate(
            cluster__velocity_score=Subquery(
                latest_snapshot_queryset.values("velocity_score")[:1]
            )
        )
    )


def _get_theme_suggestion_or_404(
    project_id: int, suggestion_id: int
) -> ThemeSuggestion:
    """Load one theme suggestion for the selected project."""

    suggestion = (
        _theme_suggestion_queryset()
        .filter(
            project_id=project_id,
            pk=suggestion_id,
        )
        .first()
    )
    if not suggestion:
        raise HttpError(404, "Not found.")
    return suggestion


def _original_content_idea_queryset():
    """Return the canonical queryset for original content ideas."""

    return OriginalContentIdea.objects.select_related(
        "project",
        "related_cluster",
        "decided_by",
        "related_cluster__dominant_entity",
    ).prefetch_related(
        Prefetch(
            "supporting_contents",
            queryset=Content.objects.order_by("-published_date", "-id"),
        )
    )


def _get_original_content_idea_or_404(
    project_id: int, idea_id: int
) -> OriginalContentIdea:
    """Load one original content idea for the selected project."""

    idea = (
        _original_content_idea_queryset()
        .filter(
            project_id=project_id,
            pk=idea_id,
        )
        .first()
    )
    if not idea:
        raise HttpError(404, "Not found.")
    return idea


def _get_topic_centroid_snapshot_or_404(
    project_id: int, snapshot_id: int
) -> TopicCentroidSnapshot:
    """Load one centroid snapshot for the selected project."""

    snapshot = (
        TopicCentroidSnapshot.objects.select_related("project")
        .filter(
            project_id=project_id,
            pk=snapshot_id,
        )
        .first()
    )
    if not snapshot:
        raise HttpError(404, "Not found.")
    return snapshot


def _get_source_diversity_snapshot_or_404(
    project_id: int, snapshot_id: int
) -> SourceDiversitySnapshot:
    """Load one source diversity snapshot for the selected project."""

    snapshot = (
        SourceDiversitySnapshot.objects.select_related("project")
        .filter(
            project_id=project_id,
            pk=snapshot_id,
        )
        .first()
    )
    if not snapshot:
        raise HttpError(404, "Not found.")
    return snapshot


def _get_trend_task_run_or_404(project_id: int, run_id: int) -> TrendTaskRun:
    """Load one trend task run for the selected project."""

    run = (
        TrendTaskRun.objects.select_related("project")
        .filter(
            project_id=project_id,
            pk=run_id,
        )
        .first()
    )
    if not run:
        raise HttpError(404, "Not found.")
    return run


@clusters_router.get("/", response=list[TopicClusterSchema], auth=api_authenticate)
def list_topic_clusters(request: Any, project_id: int = Path(...)):
    """List topic clusters visible to the current project member."""

    _require_project_member(request, project_id)
    clusters = (
        _topic_cluster_queryset()
        .filter(project_id=project_id)
        .order_by("-velocity_score", "-last_seen_at")
    )
    return [_serialize_topic_cluster(cluster) for cluster in clusters]


@clusters_router.get(
    "/{cluster_id}/",
    response=dict[str, Any],
    auth=api_authenticate,
)
def get_topic_cluster(
    request: Any,
    project_id: int = Path(...),
    cluster_id: int = Path(...),
):
    """Return one topic cluster with memberships and velocity history."""

    _require_project_member(request, project_id)
    return _serialize_topic_cluster_detail(
        _get_topic_cluster_or_404(project_id, cluster_id, for_detail=True)
    )


@clusters_router.get(
    "/{cluster_id}/velocity_history/",
    response={200: list[TopicVelocitySnapshotSchema], 400: dict[str, str]},
    auth=api_authenticate,
)
def topic_cluster_velocity_history(
    request: Any,
    project_id: int = Path(...),
    cluster_id: int = Path(...),
    limit: int | None = None,
):
    """Return recent velocity snapshots for one topic cluster."""

    cluster = _get_topic_cluster_or_404(project_id, cluster_id)
    _require_project_member(request, project_id)
    snapshots = cluster.velocity_snapshots.order_by("-computed_at")
    if limit is not None:
        if limit < 1 or limit > 100:
            return Status(
                400,
                {"limit": "Limit must be an integer between 1 and 100."},
            )
        snapshots = snapshots[:limit]
    return [_serialize_velocity_snapshot(snapshot) for snapshot in snapshots]


@themes_router.get("/", response=list[ThemeSuggestionSchema], auth=api_authenticate)
def list_theme_suggestions(request: Any, project_id: int = Path(...)):
    """List theme suggestions visible to the current project member."""

    _require_project_member(request, project_id)
    suggestions = (
        _theme_suggestion_queryset()
        .filter(project_id=project_id)
        .order_by("status", "-velocity_at_creation", "-created_at")
    )
    return [_serialize_theme_suggestion(suggestion) for suggestion in suggestions]


@themes_router.post(
    "/{suggestion_id}/accept/",
    response={200: ThemeSuggestionSchema, 400: dict[str, str]},
    auth=api_authenticate,
)
def accept_theme_suggestion_route(
    request: Any,
    project_id: int = Path(...),
    suggestion_id: int = Path(...),
):
    """Accept one pending theme suggestion."""

    _require_project_contributor(request, project_id)
    suggestion = _get_theme_suggestion_or_404(project_id, suggestion_id)
    try:
        accept_theme_suggestion(suggestion, user_id=request.user.id)
    except ValueError:
        return Status(
            400,
            {"status": "Unable to accept this theme suggestion."},
        )
    return _serialize_theme_suggestion(
        _get_theme_suggestion_or_404(project_id, suggestion_id)
    )


@themes_router.post(
    "/{suggestion_id}/dismiss/",
    response={200: ThemeSuggestionSchema, 400: dict[str, str]},
    auth=api_authenticate,
)
def dismiss_theme_suggestion_route(
    request: Any,
    payload: DismissInputSchema = Body(...),
    project_id: int = Path(...),
    suggestion_id: int = Path(...),
):
    """Dismiss one pending theme suggestion."""

    _require_project_contributor(request, project_id)
    suggestion = _get_theme_suggestion_or_404(project_id, suggestion_id)
    try:
        dismiss_theme_suggestion(
            suggestion,
            user_id=request.user.id,
            reason=_normalized_reason(payload.reason),
        )
    except ValueError:
        return Status(
            400,
            {"status": "Unable to dismiss this theme suggestion."},
        )
    return _serialize_theme_suggestion(
        _get_theme_suggestion_or_404(project_id, suggestion_id)
    )


@ideas_router.get("/", response=list[OriginalContentIdeaSchema], auth=api_authenticate)
def list_original_content_ideas(request: Any, project_id: int = Path(...)):
    """List original content ideas visible to the current project member."""

    _require_project_member(request, project_id)
    ideas = (
        _original_content_idea_queryset()
        .filter(project_id=project_id)
        .order_by("status", "-self_critique_score", "-created_at")
    )
    return [_serialize_original_content_idea(idea) for idea in ideas]


@ideas_router.post(
    "/generate/",
    response={
        200: OriginalContentIdeaGenerateCompletedSchema,
        202: OriginalContentIdeaGenerateQueuedSchema,
    },
    auth=api_authenticate,
)
def generate_original_content_ideas_route(
    request: Any,
    project_id: int = Path(...),
):
    """Trigger original content idea generation for the selected project."""

    project = _require_project_contributor(request, project_id)
    resolved_project_id = _require_pk(project)
    if task_always_eager():
        result = generate_original_content_ideas(resolved_project_id)
        return Status(
            200,
            {
                "status": "completed",
                "project_id": resolved_project_id,
                "result": result,
            },
        )
    enqueue_task(generate_original_content_ideas, resolved_project_id)
    return Status(202, {"status": "queued", "project_id": resolved_project_id})


@ideas_router.post(
    "/{idea_id}/accept/",
    response={200: OriginalContentIdeaSchema, 400: dict[str, str]},
    auth=api_authenticate,
)
def accept_original_content_idea_route(
    request: Any,
    project_id: int = Path(...),
    idea_id: int = Path(...),
):
    """Accept one pending original content idea."""

    _require_project_contributor(request, project_id)
    idea = _get_original_content_idea_or_404(project_id, idea_id)
    try:
        accept_original_content_idea(idea, user_id=request.user.id)
    except ValueError:
        return Status(
            400,
            {"status": "Unable to accept this original content idea."},
        )
    return _serialize_original_content_idea(
        _get_original_content_idea_or_404(project_id, idea_id)
    )


@ideas_router.post(
    "/{idea_id}/dismiss/",
    response={200: OriginalContentIdeaSchema, 400: dict[str, str]},
    auth=api_authenticate,
)
def dismiss_original_content_idea_route(
    request: Any,
    payload: DismissInputSchema = Body(...),
    project_id: int = Path(...),
    idea_id: int = Path(...),
):
    """Dismiss one pending original content idea."""

    _require_project_contributor(request, project_id)
    idea = _get_original_content_idea_or_404(project_id, idea_id)
    try:
        dismiss_original_content_idea(
            idea,
            user_id=request.user.id,
            reason=_normalized_reason(payload.reason),
        )
    except ValueError:
        return Status(
            400,
            {"status": "Unable to dismiss this original content idea."},
        )
    return _serialize_original_content_idea(
        _get_original_content_idea_or_404(project_id, idea_id)
    )


@ideas_router.post(
    "/{idea_id}/mark_written/",
    response={200: OriginalContentIdeaSchema, 400: dict[str, str]},
    auth=api_authenticate,
)
def mark_original_content_idea_written_route(
    request: Any,
    project_id: int = Path(...),
    idea_id: int = Path(...),
):
    """Mark one accepted original content idea as written."""

    _require_project_contributor(request, project_id)
    idea = _get_original_content_idea_or_404(project_id, idea_id)
    try:
        mark_original_content_idea_written(idea, user_id=request.user.id)
    except ValueError:
        return Status(
            400,
            {"status": "Unable to mark this original content idea as written."},
        )
    return _serialize_original_content_idea(
        _get_original_content_idea_or_404(project_id, idea_id)
    )


@topic_centroid_snapshots_router.get(
    "/",
    response=list[TopicCentroidSnapshotSchema],
    auth=api_authenticate,
)
def list_topic_centroid_snapshots(request: Any, project_id: int = Path(...)):
    """List topic centroid snapshots visible to project contributors."""

    _require_project_contributor(request, project_id)
    snapshots = TopicCentroidSnapshot.objects.select_related("project").filter(
        project_id=project_id
    )
    return [_serialize_topic_centroid_snapshot(snapshot) for snapshot in snapshots]


@topic_centroid_snapshots_router.get(
    "/summary/",
    response=TopicCentroidObservabilitySummarySchema,
    auth=api_authenticate,
)
def topic_centroid_snapshot_summary(request: Any, project_id: int = Path(...)):
    """Return aggregate centroid observability metrics."""

    project = _require_project_contributor(request, project_id)
    queryset = TopicCentroidSnapshot.objects.select_related("project").filter(
        project_id=project_id
    )
    metrics = queryset.aggregate(
        snapshot_count=Count("id"),
        active_snapshot_count=Count("id", filter=Q(centroid_active=True)),
        avg_drift_from_previous=Avg("drift_from_previous"),
        avg_drift_from_week_ago=Avg("drift_from_week_ago"),
    )
    payload = {
        "project": _require_pk(project),
        "snapshot_count": metrics["snapshot_count"],
        "active_snapshot_count": metrics["active_snapshot_count"],
        "avg_drift_from_previous": metrics["avg_drift_from_previous"],
        "avg_drift_from_week_ago": metrics["avg_drift_from_week_ago"],
        "latest_snapshot": queryset.order_by("-computed_at").first(),
    }
    return {
        **payload,
        "latest_snapshot": (
            _serialize_topic_centroid_snapshot(payload["latest_snapshot"])
            if payload["latest_snapshot"] is not None
            else None
        ),
    }


@topic_centroid_snapshots_router.get(
    "/{snapshot_id}/",
    response=TopicCentroidSnapshotSchema,
    auth=api_authenticate,
)
def get_topic_centroid_snapshot(
    request: Any,
    project_id: int = Path(...),
    snapshot_id: int = Path(...),
):
    """Return one topic centroid snapshot."""

    _require_project_contributor(request, project_id)
    return _serialize_topic_centroid_snapshot(
        _get_topic_centroid_snapshot_or_404(project_id, snapshot_id)
    )


@source_diversity_snapshots_router.get(
    "/",
    response=list[SourceDiversitySnapshotSchema],
    auth=api_authenticate,
)
def list_source_diversity_snapshots(request: Any, project_id: int = Path(...)):
    """List source diversity snapshots visible to project contributors."""

    _require_project_contributor(request, project_id)
    snapshots = SourceDiversitySnapshot.objects.select_related("project").filter(
        project_id=project_id
    )
    return [_serialize_source_diversity_snapshot(snapshot) for snapshot in snapshots]


@source_diversity_snapshots_router.get(
    "/summary/",
    response=SourceDiversityObservabilitySummarySchema,
    auth=api_authenticate,
)
def source_diversity_snapshot_summary(request: Any, project_id: int = Path(...)):
    """Return project-level source diversity observability metrics."""

    project = _require_project_contributor(request, project_id)
    queryset = SourceDiversitySnapshot.objects.select_related("project").filter(
        project_id=project_id
    )
    payload = {
        "project": _require_pk(project),
        "snapshot_count": queryset.count(),
        "latest_snapshot": queryset.order_by("-computed_at").first(),
    }
    return {
        **payload,
        "latest_snapshot": (
            _serialize_source_diversity_snapshot(payload["latest_snapshot"])
            if payload["latest_snapshot"] is not None
            else None
        ),
    }


@source_diversity_snapshots_router.get(
    "/{snapshot_id}/",
    response=SourceDiversitySnapshotSchema,
    auth=api_authenticate,
)
def get_source_diversity_snapshot(
    request: Any,
    project_id: int = Path(...),
    snapshot_id: int = Path(...),
):
    """Return one source diversity snapshot."""

    _require_project_contributor(request, project_id)
    return _serialize_source_diversity_snapshot(
        _get_source_diversity_snapshot_or_404(project_id, snapshot_id)
    )


@trend_task_runs_router.get(
    "/",
    response=list[TrendTaskRunSchema],
    auth=api_authenticate,
)
def list_trend_task_runs(request: Any, project_id: int = Path(...)):
    """List persisted trend task runs visible to project contributors."""

    _require_project_contributor(request, project_id)
    runs = TrendTaskRun.objects.select_related("project").filter(project_id=project_id)
    return [_serialize_trend_task_run(run) for run in runs]


@trend_task_runs_router.get(
    "/summary/",
    response=TrendTaskRunObservabilitySummarySchema,
    auth=api_authenticate,
)
def trend_task_run_summary(request: Any, project_id: int = Path(...)):
    """Return the latest persisted run for each tracked trend task."""

    project = _require_project_contributor(request, project_id)
    queryset = (
        TrendTaskRun.objects.select_related("project")
        .filter(project_id=project_id)
        .order_by("task_name", "-started_at")
    )
    latest_by_task: dict[str, TrendTaskRun] = {}
    for task_run in queryset:
        latest_by_task.setdefault(task_run.task_name, task_run)

    latest_runs = [
        latest_by_task[task_name]
        for task_name in TRACKED_TREND_TASKS
        if task_name in latest_by_task
    ]
    payload = {
        "project": _require_pk(project),
        "run_count": queryset.count(),
        "failed_run_count": queryset.filter(status="failed").count(),
        "latest_runs": latest_runs,
    }
    return {
        **payload,
        "latest_runs": [_serialize_trend_task_run(run) for run in latest_runs],
    }


@trend_task_runs_router.get(
    "/{run_id}/",
    response=TrendTaskRunSchema,
    auth=api_authenticate,
)
def get_trend_task_run(
    request: Any,
    project_id: int = Path(...),
    run_id: int = Path(...),
):
    """Return one persisted trend task run."""

    _require_project_contributor(request, project_id)
    return _serialize_trend_task_run(_get_trend_task_run_or_404(project_id, run_id))


__all__ = [
    "clusters_router",
    "ideas_router",
    "source_diversity_snapshots_router",
    "themes_router",
    "topic_centroid_snapshots_router",
    "trend_task_runs_router",
]
