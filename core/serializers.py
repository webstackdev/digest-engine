"""DRF serializers for project-scoped core models.

These serializers enforce the project's access rules at the API boundary. They do
more than simple field translation: several serializers limit related querysets to
 the active project and validate that cross-project relationships cannot be posted.
"""

from django.contrib.auth.models import Group
from rest_framework import serializers

from core.models import (
    Content,
    Entity,
    IngestionRun,
    IntakeAllowlist,
    NewsletterIntake,
    Project,
    ProjectConfig,
    ReviewQueue,
    SkillResult,
    SourceConfig,
    UserFeedback,
)
from core.plugins import validate_plugin_config


class ProjectScopedSerializerMixin:
    """Limit serializer relationship fields to objects the current user can access."""

    def _filter_related_queryset(self, request):
        """Constrain related-field querysets using the request user and project context."""

        user = request.user
        project = self.context.get("project")
        if "group" in self.fields:
            self.fields["group"].queryset = Group.objects.filter(user=user)
        if "project" in self.fields:
            self.fields["project"].queryset = Project.objects.filter(
                group__user=user
            ).distinct()
        if "entity" in self.fields:
            entity_queryset = (
                Entity.objects.filter(project=project)
                if project
                else Entity.objects.filter(project__group__user=user)
            )
            self.fields["entity"].queryset = entity_queryset
        if "content" in self.fields:
            content_queryset = (
                Content.objects.filter(project=project)
                if project
                else Content.objects.filter(project__group__user=user)
            )
            self.fields["content"].queryset = content_queryset
        if "superseded_by" in self.fields:
            skill_result_queryset = (
                SkillResult.objects.filter(project=project)
                if project
                else SkillResult.objects.filter(project__group__user=user)
            )
            self.fields["superseded_by"].queryset = skill_result_queryset

    def __init__(self, *args, **kwargs):
        """Initialize the serializer and scope relation fields when authenticated."""

        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self._filter_related_queryset(request)


class ProjectSerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize top-level project records."""

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "group",
            "topic_description",
            "content_retention_days",
            "intake_token",
            "intake_enabled",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ProjectConfigSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize per-project authority and scoring settings."""

    class Meta:
        model = ProjectConfig
        fields = [
            "id",
            "project",
            "upvote_authority_weight",
            "downvote_authority_weight",
            "authority_decay_rate",
        ]
        read_only_fields = ["id", "project"]


class EntitySerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize tracked entities for a project."""

    class Meta:
        model = Entity
        fields = [
            "id",
            "project",
            "name",
            "type",
            "description",
            "authority_score",
            "website_url",
            "github_url",
            "linkedin_url",
            "bluesky_handle",
            "mastodon_handle",
            "twitter_handle",
            "created_at",
        ]
        read_only_fields = ["id", "project", "created_at"]


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
            "published_date",
            "ingested_at",
            "content_text",
            "relevance_score",
            "embedding_id",
            "source_metadata",
            "is_reference",
            "is_active",
        ]
        read_only_fields = ["id", "project", "ingested_at", "embedding_id"]

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


class SkillResultSerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize persisted AI skill executions for content."""

    class Meta:
        model = SkillResult
        fields = [
            "id",
            "content",
            "project",
            "skill_name",
            "status",
            "result_data",
            "error_message",
            "model_used",
            "latency_ms",
            "confidence",
            "created_at",
            "superseded_by",
        ]
        read_only_fields = ["id", "project", "created_at"]

    def validate(self, attrs):
        """Reject skill results whose content does not belong to the active project."""

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


class SourceConfigSerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize source-plugin configuration and normalize provider settings."""

    class Meta:
        model = SourceConfig
        fields = [
            "id",
            "project",
            "plugin_name",
            "config",
            "is_active",
            "last_fetched_at",
        ]
        read_only_fields = ["id", "project", "last_fetched_at"]

    def validate(self, attrs):
        """Validate plugin-specific configuration with the plugin registry."""

        plugin_name = attrs.get("plugin_name") or getattr(
            self.instance, "plugin_name", None
        )
        config = attrs.get("config") or getattr(self.instance, "config", {})
        if plugin_name:
            try:
                attrs["config"] = validate_plugin_config(plugin_name, config)
            except ValueError as exc:
                raise serializers.ValidationError({"config": str(exc)}) from exc
        return attrs


class ReviewQueueSerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize manual-review queue items for project content."""

    class Meta:
        model = ReviewQueue
        fields = [
            "id",
            "project",
            "content",
            "reason",
            "confidence",
            "created_at",
            "resolved",
            "resolution",
        ]
        read_only_fields = ["id", "project", "created_at"]

    def validate(self, attrs):
        """Reject review items whose content does not belong to the active project."""

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


class IntakeAllowlistSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize confirmed and pending newsletter sender allowlist entries."""

    class Meta:
        model = IntakeAllowlist
        fields = [
            "id",
            "project",
            "sender_email",
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
