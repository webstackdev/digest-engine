"""API route registration for newsletter intake resources."""

from rest_framework_nested.routers import NestedSimpleRouter

from newsletters.api import (
    IntakeAllowlistViewSet,
    NewsletterDraftItemViewSet,
    NewsletterDraftOriginalPieceViewSet,
    NewsletterDraftSectionViewSet,
    NewsletterDraftViewSet,
    NewsletterIntakeViewSet,
)


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
    project_router.register(
        r"drafts",
        NewsletterDraftViewSet,
        basename="project-newsletter-draft",
    )
    project_router.register(
        r"draft-sections",
        NewsletterDraftSectionViewSet,
        basename="project-newsletter-draft-section",
    )
    project_router.register(
        r"draft-items",
        NewsletterDraftItemViewSet,
        basename="project-newsletter-draft-item",
    )
    project_router.register(
        r"draft-original-pieces",
        NewsletterDraftOriginalPieceViewSet,
        basename="project-newsletter-draft-original-piece",
    )
