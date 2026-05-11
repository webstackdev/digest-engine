"""Content-domain API viewsets kept under the existing nested project routes."""

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from content.models import Content, UserFeedback
from content.serializers import ContentSerializer, UserFeedbackSerializer
from core.api import (
    AUTHENTICATION_REQUIRED_RESPONSE,
    CONTENT_CREATE_REQUEST_EXAMPLE,
    CONTENT_RESPONSE_EXAMPLE,
    PROJECT_ID_PARAMETER,
    SKILL_NAME_PARAMETER,
    ProjectOwnedQuerysetMixin,
    build_crud_action_overrides,
    document_project_owned_viewset,
)
from core.permissions import (
    IsProjectAdmin,
    IsProjectFeedbackEditor,
    IsProjectMember,
    IsProjectMemberWritable,
)
from pipeline.serializers import SkillResultSerializer

CLASSIFICATION_SKILL_NAME = "content_classification"
RELEVANCE_SKILL_NAME = "relevance_scoring"
SUMMARIZATION_SKILL_NAME = "summarization"
RELATED_CONTENT_SKILL_NAME = "find_related"


@document_project_owned_viewset(
    resource_plural="content items",
    resource_singular="content item",
    create_description="Create a new content item for the selected project. Any related entity must belong to the same project.",
    tag="Content Library",
    action_overrides=build_crud_action_overrides(
        ContentSerializer,
        resource_plural="content items for the selected project",
        resource_singular="content item",
        create_examples=[CONTENT_CREATE_REQUEST_EXAMPLE, CONTENT_RESPONSE_EXAMPLE],
        create_response_examples=[CONTENT_RESPONSE_EXAMPLE],
        retrieve_examples=[CONTENT_RESPONSE_EXAMPLE],
    ),
)
class ContentViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Browse project content and trigger ad hoc AI processing for it."""

    serializer_class = ContentSerializer
    queryset = Content.objects.select_related("project", "entity")

    def get_permissions(self):
        """Allow all members to read content, contributors to edit, and admins to delete."""

        permission_classes: list[type[BasePermission]]
        if self.action == "destroy":
            permission_classes = [IsProjectAdmin]
        elif self.action in {"create", "update", "partial_update", "run_skill"}:
            permission_classes = [IsProjectMemberWritable]
        else:
            permission_classes = [IsProjectMember]
        return [permission() for permission in permission_classes]

    @extend_schema(
        summary="Run content skill",
        description=(
            "Run one ad hoc skill for the selected content item and persist the outcome as a SkillResult. "
            "Supported skill names are content_classification, relevance_scoring, summarization, and find_related."
        ),
        tags=["AI Processing"],
        parameters=[PROJECT_ID_PARAMETER, SKILL_NAME_PARAMETER],
        request=None,
        responses={
            201: SkillResultSerializer,
            202: SkillResultSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
    )
    @action(detail=True, methods=["post"], url_path=r"skills/(?P<skill_name>[^/.]+)")
    def run_skill(self, request, *args, **kwargs):
        """Execute one supported ad hoc skill for a content item."""

        from core.pipeline import execute_ad_hoc_skill
        from core.tasks import queue_content_skill

        skill_name = str(kwargs["skill_name"])
        if skill_name not in {
            CLASSIFICATION_SKILL_NAME,
            RELEVANCE_SKILL_NAME,
            SUMMARIZATION_SKILL_NAME,
            RELATED_CONTENT_SKILL_NAME,
        }:
            raise serializers.ValidationError(
                {
                    "skill_name": (
                        "Unsupported skill. Choose one of: content_classification, relevance_scoring, "
                        "summarization, find_related."
                    )
                }
            )

        content = self.get_object()
        if skill_name in {RELEVANCE_SKILL_NAME, SUMMARIZATION_SKILL_NAME}:
            skill_result = queue_content_skill(content, skill_name)
            serializer = SkillResultSerializer(
                skill_result, context=self.get_serializer_context()
            )
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

        skill_result = execute_ad_hoc_skill(content, skill_name)
        serializer = SkillResultSerializer(
            skill_result, context=self.get_serializer_context()
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@document_project_owned_viewset(
    resource_plural="user feedback entries",
    resource_singular="user feedback entry",
    create_description="Create a new feedback entry for content in the selected project. The authenticated user is recorded automatically.",
    tag="Feedback",
    action_overrides=build_crud_action_overrides(
        UserFeedbackSerializer,
        resource_plural="user feedback entries for the selected project",
        resource_singular="user feedback entry",
    ),
)
class UserFeedbackViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Capture editor feedback on project content items."""

    serializer_class = UserFeedbackSerializer
    queryset = UserFeedback.objects.select_related("content", "project", "user")

    def get_permissions(self):
        """Allow all members to read feedback and owners or admins to modify it."""

        return [IsProjectFeedbackEditor()]

    def perform_create(self, serializer):
        """Attach the authenticated user automatically to new feedback rows."""

        serializer.save(project=self.get_project(), user=self.request.user)
