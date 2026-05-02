"""API route registration for project-owned resources."""

from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedSimpleRouter

from projects.api import (
    BlueskyCredentialsViewSet,
    LinkedInCredentialsViewSet,
    MastodonCredentialsViewSet,
    ProjectConfigViewSet,
    ProjectInvitationViewSet,
    ProjectMembershipViewSet,
    ProjectViewSet,
    SourceConfigViewSet,
)


def register_root_routes(router: DefaultRouter) -> None:
    """Register top-level project endpoints."""

    router.register("projects", ProjectViewSet, basename="project")


def register_project_routes(project_router: NestedSimpleRouter) -> None:
    """Register nested project-management endpoints."""

    project_router.register(
        r"project-configs", ProjectConfigViewSet, basename="project-config"
    )
    project_router.register(
        r"memberships", ProjectMembershipViewSet, basename="project-membership"
    )
    project_router.register(
        r"invitations", ProjectInvitationViewSet, basename="project-invitation"
    )
    project_router.register(
        r"bluesky-credentials",
        BlueskyCredentialsViewSet,
        basename="project-bluesky-credentials",
    )
    project_router.register(
        r"mastodon-credentials",
        MastodonCredentialsViewSet,
        basename="project-mastodon-credentials",
    )
    project_router.register(
        r"linkedin-credentials",
        LinkedInCredentialsViewSet,
        basename="project-linkedin-credentials",
    )
    project_router.register(
        r"source-configs", SourceConfigViewSet, basename="project-source-config"
    )
