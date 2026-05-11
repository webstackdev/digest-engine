"""Trends-domain API viewsets kept under the existing nested project routes."""

from typing import Any

from django.conf import settings
from django.db.models import Avg, Count, OuterRef, Prefetch, Q, Subquery
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response

from content.models import Content
from core.api import (
    AUTHENTICATION_REQUIRED_RESPONSE,
    ProjectOwnedQuerysetMixin,
    build_crud_action_overrides,
    document_project_owned_viewset,
)
from core.permissions import IsProjectContributor, IsProjectMember
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
from trends.serializers import (
    OriginalContentIdeaDismissSerializer,
    OriginalContentIdeaSerializer,
    SourceDiversityObservabilitySummarySerializer,
    SourceDiversitySnapshotSerializer,
    ThemeSuggestionDismissSerializer,
    ThemeSuggestionSerializer,
    TopicCentroidObservabilitySummarySerializer,
    TopicCentroidSnapshotSerializer,
    TopicClusterDetailSerializer,
    TopicClusterSerializer,
    TopicVelocitySnapshotSerializer,
    TrendTaskRunObservabilitySummarySerializer,
    TrendTaskRunSerializer,
)
from trends.tasks import (
    accept_original_content_idea,
    accept_theme_suggestion,
    dismiss_original_content_idea,
    dismiss_theme_suggestion,
    generate_original_content_ideas,
    mark_original_content_idea_written,
)


def _require_pk(instance: Any) -> int:
    """Return a saved model primary key for trends API response payloads."""

    instance_pk = getattr(instance, "pk", None)
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


@document_project_owned_viewset(
    resource_plural="topic clusters",
    resource_singular="topic cluster",
    create_description="Topic clusters are pipeline-managed analysis rows and are exposed read-only for trend exploration.",
    tag="Trend Analysis",
    action_overrides=build_crud_action_overrides(
        TopicClusterSerializer,
        resource_plural="topic clusters for the selected project",
        resource_singular="topic cluster",
    ),
)
class TopicClusterViewSet(ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Inspect a project's current topic clusters and velocity history."""

    serializer_class = TopicClusterSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = [
        "velocity_score",
        "member_count",
        "last_seen_at",
        "first_seen_at",
    ]
    ordering = ["-velocity_score", "-last_seen_at"]
    queryset = TopicCluster.objects.select_related("project", "dominant_entity")

    def get_queryset(self):
        """Annotate clusters with the latest persisted velocity metrics."""

        latest_snapshot_queryset = TopicVelocitySnapshot.objects.filter(
            cluster_id=OuterRef("pk")
        ).order_by("-computed_at")
        queryset = (
            super()
            .get_queryset()
            .annotate(
                velocity_score=Subquery(
                    latest_snapshot_queryset.values("velocity_score")[:1]
                ),
                z_score=Subquery(latest_snapshot_queryset.values("z_score")[:1]),
                window_count=Subquery(
                    latest_snapshot_queryset.values("window_count")[:1]
                ),
                velocity_computed_at=Subquery(
                    latest_snapshot_queryset.values("computed_at")[:1]
                ),
            )
        )
        if self.action == "retrieve":
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

    def get_serializer_class(self) -> Any:
        """Return the detail serializer for cluster drill-down responses."""

        if self.action == "retrieve":
            return TopicClusterDetailSerializer
        return super().get_serializer_class()

    def get_permissions(self):
        """Allow project members to inspect trend clusters."""

        return [IsProjectMember()]

    @extend_schema(
        summary="List velocity history",
        description=(
            "Return persisted velocity snapshots for one topic cluster. "
            "Use the optional limit query parameter to cap the number of snapshots returned."
        ),
        parameters=[
            OpenApiParameter(
                name="limit",
                type=int,
                location=OpenApiParameter.QUERY,
                description="Maximum number of velocity snapshots to return.",
                required=False,
            )
        ],
        request=None,
        responses={
            200: TopicVelocitySnapshotSerializer(many=True),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Trend Analysis"],
    )
    @action(detail=True, methods=["get"], url_path="velocity_history")
    def velocity_history(self, request, *args, **kwargs):
        """Return recent velocity snapshots for the selected topic cluster."""

        cluster = self.get_object()
        snapshots = cluster.velocity_snapshots.order_by("-computed_at")
        limit_param = request.query_params.get("limit")
        if limit_param:
            try:
                limit = max(1, min(int(limit_param), 100))
            except ValueError as exc:
                raise serializers.ValidationError(
                    {"limit": "Limit must be an integer between 1 and 100."}
                ) from exc
            snapshots = snapshots[:limit]
        serializer = TopicVelocitySnapshotSerializer(snapshots, many=True)
        return Response(serializer.data)


@document_project_owned_viewset(
    resource_plural="theme suggestions",
    resource_singular="theme suggestion",
    create_description="Theme suggestions are pipeline-managed rows and are exposed read-only aside from editorial workflow actions.",
    tag="Trend Analysis",
    action_overrides=build_crud_action_overrides(
        ThemeSuggestionSerializer,
        resource_plural="theme suggestions for the selected project",
        resource_singular="theme suggestion",
    ),
)
class ThemeSuggestionViewSet(ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Inspect and resolve project-scoped theme suggestions."""

    serializer_class = ThemeSuggestionSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at", "velocity_at_creation", "novelty_score", "status"]
    ordering = ["status", "-velocity_at_creation", "-created_at"]
    queryset = ThemeSuggestion.objects.select_related(
        "project", "cluster", "decided_by"
    )

    def get_queryset(self):
        """Annotate suggestion clusters with their latest velocity when present."""

        latest_snapshot_queryset = TopicVelocitySnapshot.objects.filter(
            cluster_id=OuterRef("cluster_id")
        ).order_by("-computed_at")
        return (
            super()
            .get_queryset()
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

    def get_permissions(self):
        """Allow members to read suggestions and contributors to resolve them."""

        if self.action in {"accept", "dismiss"}:
            return [IsProjectContributor()]
        return [IsProjectMember()]

    @extend_schema(
        summary="Accept theme suggestion",
        description="Mark a pending theme suggestion as accepted by the current editor.",
        request=None,
        responses={
            200: ThemeSuggestionSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Trend Analysis"],
    )
    @action(detail=True, methods=["post"], url_path="accept")
    def accept(self, request, *args, **kwargs):
        """Accept the selected pending theme suggestion."""

        suggestion = self.get_object()
        try:
            accept_theme_suggestion(suggestion, user_id=request.user.id)
        except ValueError as exc:
            raise serializers.ValidationError(
                {"status": "Unable to accept this theme suggestion."}
            ) from exc
        suggestion = self.get_queryset().get(pk=suggestion.pk)
        serializer = self.get_serializer(suggestion)
        return Response(serializer.data)

    @extend_schema(
        summary="Dismiss theme suggestion",
        description="Dismiss a pending theme suggestion and persist the editor's reason.",
        request=ThemeSuggestionDismissSerializer,
        responses={
            200: ThemeSuggestionSerializer,
            400: ThemeSuggestionDismissSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Trend Analysis"],
    )
    @action(detail=True, methods=["post"], url_path="dismiss")
    def dismiss(self, request, *args, **kwargs):
        """Dismiss the selected pending theme suggestion."""

        suggestion = self.get_object()
        serializer = ThemeSuggestionDismissSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        try:
            dismiss_theme_suggestion(
                suggestion,
                user_id=request.user.id,
                reason=serializer.validated_data["reason"],
            )
        except ValueError as exc:
            raise serializers.ValidationError(
                {"status": "Unable to dismiss this theme suggestion."}
            ) from exc
        response_serializer = self.get_serializer(suggestion)
        return Response(response_serializer.data)


@document_project_owned_viewset(
    resource_plural="original content ideas",
    resource_singular="original content idea",
    create_description="Original content ideas are pipeline-managed rows and are exposed read-only aside from editorial workflow actions.",
    tag="Trend Analysis",
    action_overrides=build_crud_action_overrides(
        OriginalContentIdeaSerializer,
        resource_plural="original content ideas for the selected project",
        resource_singular="original content idea",
    ),
)
class OriginalContentIdeaViewSet(
    ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet
):
    """Inspect and resolve project-scoped original-content ideas."""

    serializer_class = OriginalContentIdeaSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at", "self_critique_score", "status"]
    ordering = ["status", "-self_critique_score", "-created_at"]
    queryset = OriginalContentIdea.objects.select_related(
        "project", "related_cluster", "decided_by"
    )

    def get_queryset(self):
        """Prefetch supporting contents for original-content idea responses."""

        return (
            super()
            .get_queryset()
            .select_related("related_cluster__dominant_entity")
            .prefetch_related(
                Prefetch(
                    "supporting_contents",
                    queryset=Content.objects.order_by("-published_date", "-id"),
                )
            )
        )

    def get_permissions(self):
        """Allow members to read ideas and contributors to resolve them."""

        if self.action in {"accept", "dismiss", "mark_written", "generate"}:
            return [IsProjectContributor()]
        return [IsProjectMember()]

    @extend_schema(
        summary="Generate original content ideas",
        description=(
            "Trigger original-content idea generation for the selected project. "
            "When Celery runs eagerly, ideas are generated before the response is returned. "
            "Otherwise, the generation task is queued for background execution."
        ),
        request=None,
        responses={
            200: inline_serializer(
                name="OriginalContentIdeaGenerateCompletedResponse",
                fields={
                    "status": serializers.CharField(),
                    "project_id": serializers.IntegerField(),
                    "result": inline_serializer(
                        name="OriginalContentIdeaGenerateResult",
                        fields={
                            "project_id": serializers.IntegerField(),
                            "clusters_considered": serializers.IntegerField(),
                            "created": serializers.IntegerField(),
                            "skipped": serializers.IntegerField(),
                        },
                    ),
                },
            ),
            202: inline_serializer(
                name="OriginalContentIdeaGenerateQueuedResponse",
                fields={
                    "status": serializers.CharField(),
                    "project_id": serializers.IntegerField(),
                },
            ),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Trend Analysis"],
    )
    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request, *args, **kwargs):
        """Trigger original-content idea generation for the current project."""

        project = self.get_project()
        project_id = _require_pk(project)
        if settings.CELERY_TASK_ALWAYS_EAGER:
            result = generate_original_content_ideas(project_id)
            return Response(
                {
                    "status": "completed",
                    "project_id": project_id,
                    "result": result,
                }
            )
        generate_original_content_ideas.delay(project_id)
        return Response(
            {"status": "queued", "project_id": project_id},
            status=status.HTTP_202_ACCEPTED,
        )

    @extend_schema(
        summary="Accept original content idea",
        description="Mark a pending original content idea as accepted by the current editor.",
        request=None,
        responses={
            200: OriginalContentIdeaSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Trend Analysis"],
    )
    @action(detail=True, methods=["post"], url_path="accept")
    def accept(self, request, *args, **kwargs):
        """Accept the selected pending original-content idea."""

        idea = self.get_object()
        try:
            accept_original_content_idea(idea, user_id=request.user.id)
        except ValueError as exc:
            raise serializers.ValidationError(
                {"status": "Unable to accept this original content idea."}
            ) from exc
        response_serializer = self.get_serializer(idea)
        return Response(response_serializer.data)

    @extend_schema(
        summary="Dismiss original content idea",
        description="Dismiss a pending original content idea and persist the editor's reason.",
        request=OriginalContentIdeaDismissSerializer,
        responses={
            200: OriginalContentIdeaSerializer,
            400: OriginalContentIdeaDismissSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Trend Analysis"],
    )
    @action(detail=True, methods=["post"], url_path="dismiss")
    def dismiss(self, request, *args, **kwargs):
        """Dismiss the selected pending original-content idea."""

        idea = self.get_object()
        serializer = OriginalContentIdeaDismissSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        try:
            dismiss_original_content_idea(
                idea,
                user_id=request.user.id,
                reason=serializer.validated_data["reason"],
            )
        except ValueError as exc:
            raise serializers.ValidationError(
                {"status": "Unable to dismiss this original content idea."}
            ) from exc
        response_serializer = self.get_serializer(idea)
        return Response(response_serializer.data)

    @extend_schema(
        summary="Mark original content idea written",
        description="Mark an accepted original content idea as written by the current editor.",
        request=None,
        responses={
            200: OriginalContentIdeaSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Trend Analysis"],
    )
    @action(detail=True, methods=["post"], url_path="mark_written")
    def mark_written(self, request, *args, **kwargs):
        """Mark the selected accepted original-content idea as written."""

        idea = self.get_object()
        try:
            mark_original_content_idea_written(idea, user_id=request.user.id)
        except ValueError as exc:
            raise serializers.ValidationError(
                {"status": "Unable to mark this original content idea as written."}
            ) from exc
        response_serializer = self.get_serializer(idea)
        return Response(response_serializer.data)


@document_project_owned_viewset(
    resource_plural="topic centroid snapshots",
    resource_singular="topic centroid snapshot",
    create_description="Topic centroid snapshots are pipeline-managed history rows and are exposed read-only for observability.",
    tag="Observability",
    action_overrides=build_crud_action_overrides(
        TopicCentroidSnapshotSerializer,
        resource_plural="topic centroid snapshots for the selected project",
        resource_singular="topic centroid snapshot",
    ),
)
class TopicCentroidSnapshotViewSet(
    ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet
):
    """Inspect persisted centroid history and aggregate drift for a project."""

    serializer_class = TopicCentroidSnapshotSerializer
    queryset = TopicCentroidSnapshot.objects.select_related("project")

    def get_permissions(self):
        """Restrict centroid observability to project contributors."""
        return [IsProjectContributor()]

    @extend_schema(
        summary="Get topic centroid summary",
        description=(
            "Return aggregate centroid observability metrics for the selected project, "
            "including average drift and the latest persisted snapshot."
        ),
        request=None,
        responses={
            200: TopicCentroidObservabilitySummarySerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Observability"],
    )
    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request, *args, **kwargs):
        """Return centroid observability summary metrics for the current project."""

        queryset = self.get_queryset()
        metrics = queryset.aggregate(
            snapshot_count=Count("id"),
            active_snapshot_count=Count("id", filter=Q(centroid_active=True)),
            avg_drift_from_previous=Avg("drift_from_previous"),
            avg_drift_from_week_ago=Avg("drift_from_week_ago"),
        )
        serializer = TopicCentroidObservabilitySummarySerializer(
            {
                "project": _require_pk(self.get_project()),
                "snapshot_count": metrics["snapshot_count"],
                "active_snapshot_count": metrics["active_snapshot_count"],
                "avg_drift_from_previous": metrics["avg_drift_from_previous"],
                "avg_drift_from_week_ago": metrics["avg_drift_from_week_ago"],
                "latest_snapshot": queryset.order_by("-computed_at").first(),
            },
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)


@document_project_owned_viewset(
    resource_plural="source diversity snapshots",
    resource_singular="source diversity snapshot",
    create_description="Source diversity snapshots are pipeline-managed observability rows and are exposed read-only for health analysis.",
    tag="Observability",
    action_overrides=build_crud_action_overrides(
        SourceDiversitySnapshotSerializer,
        resource_plural="source diversity snapshots for the selected project",
        resource_singular="source diversity snapshot",
    ),
)
class SourceDiversitySnapshotViewSet(
    ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet
):
    """Inspect persisted source-diversity history for a project."""

    serializer_class = SourceDiversitySnapshotSerializer
    queryset = SourceDiversitySnapshot.objects.select_related("project")

    def get_permissions(self):
        """Restrict source-diversity observability to project contributors."""

        return [IsProjectContributor()]

    @extend_schema(
        summary="Get source diversity summary",
        description=(
            "Return the latest persisted source-diversity snapshot for the selected project "
            "along with the number of stored snapshots."
        ),
        request=None,
        responses={
            200: SourceDiversityObservabilitySummarySerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Observability"],
    )
    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request, *args, **kwargs):
        """Return source-diversity summary metrics for the current project."""

        queryset = self.get_queryset()
        serializer = SourceDiversityObservabilitySummarySerializer(
            {
                "project": _require_pk(self.get_project()),
                "snapshot_count": queryset.count(),
                "latest_snapshot": queryset.order_by("-computed_at").first(),
            },
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)


@document_project_owned_viewset(
    resource_plural="trend task runs",
    resource_singular="trend task run",
    create_description="Trend task runs are pipeline-managed execution records and are exposed read-only for observability.",
    tag="Observability",
    action_overrides=build_crud_action_overrides(
        TrendTaskRunSerializer,
        resource_plural="trend task runs for the selected project",
        resource_singular="trend task run",
    ),
)
class TrendTaskRunViewSet(ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Inspect persisted trend pipeline task executions for a project."""

    serializer_class = TrendTaskRunSerializer
    queryset = TrendTaskRun.objects.select_related("project")

    def get_permissions(self):
        """Restrict trend task observability to project contributors."""

        return [IsProjectContributor()]

    @extend_schema(
        summary="Get trend task run summary",
        description=(
            "Return the latest persisted run for each tracked trend pipeline task, "
            "along with project-level run counts and failure counts."
        ),
        request=None,
        responses={
            200: TrendTaskRunObservabilitySummarySerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Observability"],
    )
    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request, *args, **kwargs):
        """Return the latest project-scoped run for each tracked trend task."""

        queryset = self.get_queryset().order_by("task_name", "-started_at")
        latest_by_task: dict[str, TrendTaskRun] = {}
        for task_run in queryset:
            latest_by_task.setdefault(task_run.task_name, task_run)

        latest_runs = [
            latest_by_task[task_name]
            for task_name in TRACKED_TREND_TASKS
            if task_name in latest_by_task
        ]
        serializer = TrendTaskRunObservabilitySummarySerializer(
            {
                "project": _require_pk(self.get_project()),
                "run_count": queryset.count(),
                "failed_run_count": queryset.filter(status="failed").count(),
                "latest_runs": latest_runs,
            },
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)
