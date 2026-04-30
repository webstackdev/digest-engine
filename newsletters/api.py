"""Newsletter-domain API viewsets kept under the existing nested project routes."""

from rest_framework import viewsets

from core.api import (
    ProjectOwnedQuerysetMixin,
    build_crud_action_overrides,
    document_project_owned_viewset,
)
from core.permissions import IsProjectContributor, IsProjectMember
from newsletters.models import IntakeAllowlist, NewsletterIntake
from newsletters.serializers import (
    IntakeAllowlistSerializer,
    NewsletterIntakeSerializer,
)


@document_project_owned_viewset(
    resource_plural="intake allowlist entries",
    resource_singular="intake allowlist entry",
    create_description=(
        "Create a new confirmed or pending sender allowlist entry for the selected "
        "project's newsletter intake workflow."
    ),
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        IntakeAllowlistSerializer,
        resource_plural="intake allowlist entries for the selected project",
        resource_singular="intake allowlist entry",
    ),
)
class IntakeAllowlistViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Manage newsletter sender allowlist entries for a project."""

    serializer_class = IntakeAllowlistSerializer
    queryset = IntakeAllowlist.objects.select_related("project")

    def get_permissions(self):
        """Restrict intake allowlist access to project contributors."""

        return [IsProjectContributor()]


@document_project_owned_viewset(
    resource_plural="newsletter intake entries",
    resource_singular="newsletter intake entry",
    create_description=(
        "Newsletter intake entries are created by inbound email processing and are "
        "exposed read-only for audit and troubleshooting."
    ),
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        NewsletterIntakeSerializer,
        resource_plural="newsletter intake entries for the selected project",
        resource_singular="newsletter intake entry",
    ),
)
class NewsletterIntakeViewSet(ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Inspect inbound newsletter history for a project."""

    serializer_class = NewsletterIntakeSerializer
    queryset = NewsletterIntake.objects.select_related("project")

    def get_permissions(self):
        """Allow any project member to inspect newsletter intake history."""

        return [IsProjectMember()]
