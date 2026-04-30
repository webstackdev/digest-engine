"""API route registration for ingestion resources."""

from rest_framework_nested.routers import NestedSimpleRouter

from ingestion.api import IngestionRunViewSet


def register_project_routes(project_router: NestedSimpleRouter) -> None:
    """Register nested ingestion-run endpoints."""

    project_router.register(
        r"ingestion-runs", IngestionRunViewSet, basename="project-ingestion-run"
    )
