"""API route registration for trends resources."""

from rest_framework_nested.routers import NestedSimpleRouter

from trends.api import (
    ThemeSuggestionViewSet,
    TopicCentroidSnapshotViewSet,
    TopicClusterViewSet,
)


def register_project_routes(project_router: NestedSimpleRouter) -> None:
    """Register nested trend observability endpoints."""

    project_router.register(
        r"clusters",
        TopicClusterViewSet,
        basename="project-topic-cluster",
    )
    project_router.register(
        r"themes",
        ThemeSuggestionViewSet,
        basename="project-theme-suggestion",
    )
    project_router.register(
        r"topic-centroid-snapshots",
        TopicCentroidSnapshotViewSet,
        basename="project-topic-centroid-snapshot",
    )
