"""Trends-domain API viewsets kept under the existing nested project routes."""

from django.db.models import Avg, Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api import (
    AUTHENTICATION_REQUIRED_RESPONSE,
    ProjectOwnedQuerysetMixin,
    build_crud_action_overrides,
    document_project_owned_viewset,
)
from core.permissions import IsProjectContributor
from trends.models import TopicCentroidSnapshot
from trends.serializers import (
    TopicCentroidObservabilitySummarySerializer,
    TopicCentroidSnapshotSerializer,
)


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
                "project": self.get_project().id,
                "snapshot_count": metrics["snapshot_count"],
                "active_snapshot_count": metrics["active_snapshot_count"],
                "avg_drift_from_previous": metrics["avg_drift_from_previous"],
                "avg_drift_from_week_ago": metrics["avg_drift_from_week_ago"],
                "latest_snapshot": queryset.order_by("-computed_at").first(),
            },
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)
