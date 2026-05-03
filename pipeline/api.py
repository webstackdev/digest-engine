"""Pipeline-domain API viewsets kept under the existing nested project routes."""

from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.tasks import retry_pipeline_review_item
from rest_framework import viewsets

from core.api import (
    SKILL_RESULT_RESPONSE_EXAMPLE,
    ProjectOwnedQuerysetMixin,
    build_crud_action_overrides,
    document_project_owned_viewset,
)
from core.permissions import (
    IsProjectContributor,
    IsProjectMember,
    IsProjectMemberWritable,
)
from pipeline.models import ReviewQueue, ReviewResolution, SkillResult
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

    @action(detail=True, methods=["post"])
    def retry(self, request, *args, **kwargs):
        """Retry the selected review item from its failed node."""

        review_item = self.get_object()
        if settings.CELERY_TASK_ALWAYS_EAGER:
            payload = retry_pipeline_review_item(review_item.pk)
            return Response(payload, status=status.HTTP_200_OK)
        retry_pipeline_review_item.delay(review_item.pk)
        return Response(
            {
                "review_item_id": review_item.pk,
                "status": "queued",
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"])
    def resolve(self, request, *args, **kwargs):
        """Resolve the selected review item without retrying it."""

        review_item = self.get_object()
        review_item.resolved = True
        review_item.resolution = ReviewResolution.MANUALLY_RESOLVED
        review_item.resolved_at = timezone.now()
        review_item.save(update_fields=["resolved", "resolution", "resolved_at"])
        serializer = self.get_serializer(review_item)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def archive(self, request, *args, **kwargs):
        """Archive the selected review item."""

        review_item = self.get_object()
        review_item.resolved = True
        review_item.resolution = ReviewResolution.ARCHIVED
        review_item.resolved_at = timezone.now()
        review_item.save(update_fields=["resolved", "resolution", "resolved_at"])
        serializer = self.get_serializer(review_item)
        return Response(serializer.data, status=status.HTTP_200_OK)
