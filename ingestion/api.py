"""Ingestion-domain API viewsets kept under the existing nested project routes."""

from rest_framework import viewsets
from rest_framework.permissions import BasePermission

from core.api import (
    ProjectOwnedQuerysetMixin,
    build_crud_action_overrides,
    document_project_owned_viewset,
)
from core.permissions import IsProjectMember, IsProjectMemberWritable
from ingestion.models import IngestionRun
from ingestion.serializers import IngestionRunSerializer


@document_project_owned_viewset(
    resource_plural="ingestion runs",
    resource_singular="ingestion run",
    create_description="Create a new ingestion run record for the selected project to track a content ingestion attempt and its status.",
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        IngestionRunSerializer,
        resource_plural="ingestion runs for the selected project",
        resource_singular="ingestion run",
    ),
)
class IngestionRunViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Inspect ingestion-run history for a project."""

    serializer_class = IngestionRunSerializer
    queryset = IngestionRun.objects.select_related("project")

    def get_permissions(self):
        """Allow all members to read ingestion runs and contributors to manage them."""

        permission_classes: list[type[BasePermission]]
        if self.action in {"create", "update", "partial_update", "destroy"}:
            permission_classes = [IsProjectMemberWritable]
        else:
            permission_classes = [IsProjectMember]
        return [permission() for permission in permission_classes]
