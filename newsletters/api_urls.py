"""API route registration for newsletter intake resources."""

from rest_framework_nested.routers import NestedSimpleRouter

from newsletters.api import IntakeAllowlistViewSet, NewsletterIntakeViewSet


def register_project_routes(project_router: NestedSimpleRouter) -> None:
    """Register nested newsletter intake endpoints."""

    project_router.register(
        r"intake-allowlist",
        IntakeAllowlistViewSet,
        basename="project-intake-allowlist",
    )
    project_router.register(
        r"newsletter-intakes",
        NewsletterIntakeViewSet,
        basename="project-newsletter-intake",
    )
