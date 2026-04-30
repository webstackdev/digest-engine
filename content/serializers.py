"""DRF serializers for content-domain models."""

from rest_framework import serializers

from content.models import Content, UserFeedback
from core.serializer_mixins import ProjectScopedSerializerMixin


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
