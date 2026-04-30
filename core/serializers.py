"""DRF serializers for project-scoped core models.

These serializers enforce the project's access rules at the API boundary. They do
more than simple field translation: several serializers limit related querysets to
the active project and validate that cross-project relationships cannot be posted.
"""

from importlib import import_module

from rest_framework import serializers

from core.models import (
    Content,
    IngestionRun,
    IntakeAllowlist,
    NewsletterIntake,
    SkillResult,
    UserFeedback,
)
from core.permissions import get_visible_projects_queryset
from entities.models import Entity


class ProjectScopedSerializerMixin:
    """Limit serializer relationship fields to objects the current user can access."""

    def _filter_related_queryset(self, request):
        """Constrain related-field querysets using the request user and project context."""

        user = request.user
        project = self.context.get("project")
        if "project" in self.fields:
            self.fields["project"].queryset = get_visible_projects_queryset(user)
        if "entity" in self.fields:
            entity_queryset = (
                Entity.objects.filter(project=project)
                if project
                else Entity.objects.filter(project__memberships__user=user).distinct()
            )
            self.fields["entity"].queryset = entity_queryset
        if "merged_into" in self.fields:
            merged_into_queryset = (
                Entity.objects.filter(project=project)
                if project
                else Entity.objects.filter(project__memberships__user=user).distinct()
            )
            self.fields["merged_into"].queryset = merged_into_queryset
        if "content" in self.fields:
            content_queryset = (
                Content.objects.filter(project=project)
                if project
                else Content.objects.filter(project__memberships__user=user).distinct()
            )
            self.fields["content"].queryset = content_queryset
        if "superseded_by" in self.fields:
            skill_result_queryset = (
                SkillResult.objects.filter(project=project)
                if project
                else SkillResult.objects.filter(
                    project__memberships__user=user
                ).distinct()
            )
            self.fields["superseded_by"].queryset = skill_result_queryset

    def __init__(self, *args, **kwargs):
        """Initialize the serializer and scope relation fields when authenticated."""

        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self._filter_related_queryset(request)


# Imported after ProjectScopedSerializerMixin to avoid a circular import while
# keeping the legacy core.serializers import surface stable during the app split.
from entities.serializers import (  # noqa: E402
    EntityAuthoritySnapshotSerializer,
    EntityCandidateMergeSerializer,
    EntityCandidateSerializer,
    EntityMentionSummarySerializer,
    EntitySerializer,
)

_pipeline_serializers = import_module("pipeline.serializers")
_trends_serializers = import_module("trends.serializers")

ReviewQueueSerializer = _pipeline_serializers.ReviewQueueSerializer
SkillResultSerializer = _pipeline_serializers.SkillResultSerializer
TopicCentroidObservabilitySummarySerializer = (
    _trends_serializers.TopicCentroidObservabilitySummarySerializer
)
TopicCentroidSnapshotSerializer = _trends_serializers.TopicCentroidSnapshotSerializer

__all__ = [
    "EntityAuthoritySnapshotSerializer",
    "EntityCandidateMergeSerializer",
    "EntityCandidateSerializer",
    "EntityMentionSummarySerializer",
    "EntitySerializer",
]


class ContentSerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize ingested content items and enforce project/entity consistency."""

    class Meta:
        model = Content
        fields = [
            "id",
            "project",
            "url",
            "title",
            "author",
            "entity",
            "source_plugin",
            "content_type",
            "canonical_url",
            "published_date",
            "ingested_at",
            "content_text",
            "relevance_score",
            "authority_adjusted_score",
            "embedding_id",
            "source_metadata",
            "duplicate_of",
            "duplicate_signal_count",
            "is_reference",
            "is_active",
        ]
        read_only_fields = [
            "id",
            "project",
            "canonical_url",
            "ingested_at",
            "authority_adjusted_score",
            "embedding_id",
            "duplicate_of",
            "duplicate_signal_count",
        ]

    def validate(self, attrs):
        """Reject entity assignments that point at a different project."""

        project = (
            self.context.get("project")
            or attrs.get("project")
            or getattr(self.instance, "project", None)
        )
        entity = attrs.get("entity") or getattr(self.instance, "entity", None)
        if project and entity and entity.project_id != project.id:
            raise serializers.ValidationError(
                {"entity": "Entity must belong to the selected project."}
            )
        return attrs


class UserFeedbackSerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize editor feedback attached to a content item."""

    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = UserFeedback
        fields = ["id", "content", "project", "user", "feedback_type", "created_at"]
        read_only_fields = ["id", "project", "user", "created_at"]

    def validate(self, attrs):
        """Reject feedback that targets content outside the active project."""

        project = (
            self.context.get("project")
            or attrs.get("project")
            or getattr(self.instance, "project", None)
        )
        content = attrs.get("content") or getattr(self.instance, "content", None)
        if project and content and content.project_id != project.id:
            raise serializers.ValidationError(
                {"content": "Content must belong to the selected project."}
            )
        return attrs


class IngestionRunSerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize ingestion-run audit records."""

    class Meta:
        model = IngestionRun
        fields = [
            "id",
            "project",
            "plugin_name",
            "started_at",
            "completed_at",
            "status",
            "items_fetched",
            "items_ingested",
            "error_message",
        ]
        read_only_fields = ["id", "project", "started_at"]


class IntakeAllowlistSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize confirmed and pending newsletter sender allowlist entries."""

    is_confirmed = serializers.BooleanField(read_only=True)

    class Meta:
        model = IntakeAllowlist
        fields = [
            "id",
            "project",
            "sender_email",
            "is_confirmed",
            "confirmed_at",
            "confirmation_token",
            "created_at",
        ]
        read_only_fields = ["id", "project", "confirmation_token", "created_at"]


class NewsletterIntakeSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize raw inbound newsletter messages captured for a project."""

    class Meta:
        model = NewsletterIntake
        fields = [
            "id",
            "project",
            "sender_email",
            "subject",
            "received_at",
            "raw_html",
            "raw_text",
            "message_id",
            "status",
            "extraction_result",
            "error_message",
        ]
        read_only_fields = [
            "id",
            "project",
            "received_at",
            "status",
            "extraction_result",
            "error_message",
        ]
