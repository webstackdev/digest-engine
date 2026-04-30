"""API route registration for pipeline resources."""

from rest_framework_nested.routers import NestedSimpleRouter

from pipeline.api import ReviewQueueViewSet, SkillResultViewSet


def register_project_routes(project_router: NestedSimpleRouter) -> None:
    """Register nested skill-result and review endpoints."""

    project_router.register(
        r"skill-results", SkillResultViewSet, basename="project-skill-result"
    )
    project_router.register(
        r"review-queue", ReviewQueueViewSet, basename="project-review-queue"
    )
