"""DRF serializers for project-scoped core models and compatibility exports."""

from importlib import import_module
from typing import TYPE_CHECKING, Any

from rest_framework import serializers

from core.models import (
    Content,
    IngestionRun,
    IntakeAllowlist,
    NewsletterIntake,
    UserFeedback,
)
from core.serializer_mixins import ProjectScopedSerializerMixin

if TYPE_CHECKING:
    from entities.serializers import (
        EntityAuthoritySnapshotSerializer,
        EntityCandidateMergeSerializer,
        EntityCandidateSerializer,
        EntityMentionSummarySerializer,
        EntitySerializer,
    )
    from pipeline.serializers import ReviewQueueSerializer, SkillResultSerializer
    from trends.serializers import (
        TopicCentroidObservabilitySummarySerializer,
        TopicCentroidSnapshotSerializer,
    )

_COMPAT_SERIALIZER_EXPORTS = {
    "EntityAuthoritySnapshotSerializer": (
        "entities.serializers",
        "EntityAuthoritySnapshotSerializer",
    ),
    "EntityCandidateMergeSerializer": (
        "entities.serializers",
        "EntityCandidateMergeSerializer",
    ),
    "EntityCandidateSerializer": (
        "entities.serializers",
        "EntityCandidateSerializer",
    ),
    "EntityMentionSummarySerializer": (
        "entities.serializers",
        "EntityMentionSummarySerializer",
    ),
    "EntitySerializer": ("entities.serializers", "EntitySerializer"),
    "ReviewQueueSerializer": ("pipeline.serializers", "ReviewQueueSerializer"),
    "SkillResultSerializer": ("pipeline.serializers", "SkillResultSerializer"),
    "TopicCentroidObservabilitySummarySerializer": (
        "trends.serializers",
        "TopicCentroidObservabilitySummarySerializer",
    ),
    "TopicCentroidSnapshotSerializer": (
        "trends.serializers",
        "TopicCentroidSnapshotSerializer",
    ),
}

__all__ = [
    "ProjectScopedSerializerMixin",
    "EntityAuthoritySnapshotSerializer",
    "EntityCandidateMergeSerializer",
    "EntityCandidateSerializer",
    "EntityMentionSummarySerializer",
    "EntitySerializer",
    "ReviewQueueSerializer",
    "SkillResultSerializer",
    "TopicCentroidObservabilitySummarySerializer",
    "TopicCentroidSnapshotSerializer",
]


def __getattr__(name: str) -> Any:
    """Resolve compatibility serializer re-exports lazily."""

    try:
        module_name, attribute_name = _COMPAT_SERIALIZER_EXPORTS[name]
    except KeyError as exc:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}") from exc

    value = getattr(import_module(module_name), attribute_name)
    globals()[name] = value
    return value


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
