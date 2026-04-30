"""Pipeline-domain API viewsets kept under the existing nested project routes."""

from rest_framework import viewsets

from core.api import (
    SKILL_RESULT_RESPONSE_EXAMPLE,
    ProjectOwnedQuerysetMixin,
    build_crud_action_overrides,
    document_project_owned_viewset,
)
from core.permissions import IsProjectContributor, IsProjectMember, IsProjectMemberWritable
from pipeline.models import ReviewQueue, SkillResult
from pipeline.serializers import ReviewQueueSerializer, SkillResultSerializer


@document_project_owned_viewset(
    resource_plural="skill results",
    resource_singular="skill result",
    create_description="Create a new skill result for project content. The referenced content must belong to the selected project.",
    tag="AI Processing",
    action_overrides=build_crud_action_overrides(
        SkillResultSerializer,
        resource_plural="skill results for the selected project",
        resource_singular="skill result",
        retrieve_examples=[SKILL_RESULT_RESPONSE_EXAMPLE],
    ),
)
class SkillResultViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Inspect persisted AI skill outputs for project content."""

    serializer_class = SkillResultSerializer
    queryset = SkillResult.objects.select_related("content", "project", "superseded_by")

    def get_permissions(self):
        """Allow all members to read skill results and contributors to modify them."""

        if self.action in {"create", "update", "partial_update", "destroy"}:
            permission_classes = [IsProjectMemberWritable]
        else:
            permission_classes = [IsProjectMember]
        return [permission() for permission in permission_classes]


@document_project_owned_viewset(
    resource_plural="review queue entries",
    resource_singular="review queue entry",
    create_description="Create a new review queue entry for the selected project. The referenced content must belong to the same project.",
    tag="Review Queue",
    action_overrides=build_crud_action_overrides(
        ReviewQueueSerializer,
        resource_plural="review queue entries for the selected project",
        resource_singular="review queue entry",
    ),
)
class ReviewQueueViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Inspect and manage content awaiting manual review."""

    serializer_class = ReviewQueueSerializer
    queryset = ReviewQueue.objects.select_related("content", "project")

    def get_permissions(self):
        """Restrict review-queue access to project contributors."""

        return [IsProjectContributor()]