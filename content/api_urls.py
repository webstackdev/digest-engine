"""API route registration for content resources."""

from rest_framework_nested.routers import NestedSimpleRouter

from content.api import ContentViewSet, UserFeedbackViewSet


def register_project_routes(project_router: NestedSimpleRouter) -> None:
    """Register nested content and feedback endpoints."""

    project_router.register(r"contents", ContentViewSet, basename="project-content")
    project_router.register(
        r"feedback", UserFeedbackViewSet, basename="project-feedback"
    )
