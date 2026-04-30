"""API route registration for entity resources."""

from rest_framework_nested.routers import NestedSimpleRouter

from entities.api import EntityCandidateViewSet, EntityViewSet


def register_project_routes(project_router: NestedSimpleRouter) -> None:
    """Register nested entity endpoints."""

    project_router.register(r"entities", EntityViewSet, basename="project-entity")
    project_router.register(
        r"entity-candidates",
        EntityCandidateViewSet,
        basename="project-entity-candidate",
    )
