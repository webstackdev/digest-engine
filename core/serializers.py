"""DRF serializers for project-scoped core models.

These serializers enforce the project's access rules at the API boundary. They do
more than simple field translation: several serializers limit related querysets to
 the active project and validate that cross-project relationships cannot be posted.
"""

from django.contrib.auth.models import Group
from rest_framework import serializers

from core.models import (
    BlueskyCredentials,
    Content,
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityMention,
    IngestionRun,
    IntakeAllowlist,
    NewsletterIntake,
    Project,
    ProjectConfig,
    ReviewQueue,
    SkillResult,
    SourceConfig,
    TopicCentroidSnapshot,
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
        if "merged_into" in self.fields:
            merged_into_queryset = (
                Entity.objects.filter(project=project)
                if project
                else Entity.objects.filter(project__group__user=user)
            )
            self.fields["merged_into"].queryset = merged_into_queryset
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

    has_bluesky_credentials = serializers.SerializerMethodField()
    bluesky_handle = serializers.SerializerMethodField()
    bluesky_is_active = serializers.SerializerMethodField()
    bluesky_last_verified_at = serializers.SerializerMethodField()
    bluesky_last_error = serializers.SerializerMethodField()

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
            "has_bluesky_credentials",
            "bluesky_handle",
            "bluesky_is_active",
            "bluesky_last_verified_at",
            "bluesky_last_error",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def _get_bluesky_credentials(self, obj: Project):
        """Return the project's stored Bluesky credentials, if configured."""

        try:
            return obj.bluesky_credentials
        except Project.bluesky_credentials.RelatedObjectDoesNotExist:
            return None

    def get_has_bluesky_credentials(self, obj: Project) -> bool:
        """Return whether the project has stored Bluesky credentials."""

        return self._get_bluesky_credentials(obj) is not None

    def get_bluesky_handle(self, obj: Project) -> str:
        """Return the stored Bluesky handle, or an empty string."""

        credentials = self._get_bluesky_credentials(obj)
        return credentials.handle if credentials else ""

    def get_bluesky_is_active(self, obj: Project) -> bool:
        """Return whether the stored Bluesky credentials are currently active."""

        credentials = self._get_bluesky_credentials(obj)
        return credentials.is_active if credentials else False

    def get_bluesky_last_verified_at(self, obj: Project):
        """Return the last successful verification timestamp, if available."""

        credentials = self._get_bluesky_credentials(obj)
        return credentials.last_verified_at if credentials else None

    def get_bluesky_last_error(self, obj: Project) -> str:
        """Return the latest Bluesky verification error, or an empty string."""

        credentials = self._get_bluesky_credentials(obj)
        return credentials.last_error if credentials else ""


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


class BlueskyCredentialsSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize project-scoped Bluesky credentials without exposing secrets."""

    app_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    has_stored_credential = serializers.SerializerMethodField()

    class Meta:
        model = BlueskyCredentials
        fields = [
            "id",
            "project",
            "handle",
            "pds_url",
            "is_active",
            "has_stored_credential",
            "app_password",
            "last_verified_at",
            "last_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "has_stored_credential",
            "last_verified_at",
            "last_error",
            "created_at",
            "updated_at",
        ]

    def get_has_stored_credential(self, obj: BlueskyCredentials) -> bool:
        """Return whether the project has an encrypted Bluesky credential stored."""

        return obj.has_stored_credential()

    def validate(self, attrs):
        """Require an app password when creating a credential record."""

        attrs = super().validate(attrs)
        app_password = attrs.get("app_password", "")
        if self.instance is None and not app_password:
            raise serializers.ValidationError(
                {"app_password": "A Bluesky app credential is required."}
            )
        return attrs

    def create(self, validated_data):
        """Encrypt the submitted Bluesky app password before saving the record."""

        app_password = validated_data.pop("app_password", "")
        instance = super().create(validated_data)
        if app_password:
            instance.set_app_password(app_password)
            instance.save(update_fields=["app_password_encrypted", "updated_at"])
        return instance

    def update(self, instance, validated_data):
        """Keep the stored credential unless a replacement app password is submitted."""

        app_password = validated_data.pop("app_password", "")
        instance = super().update(instance, validated_data)
        if app_password:
            instance.set_app_password(app_password)
            instance.save(update_fields=["app_password_encrypted", "updated_at"])
        return instance


class EntitySerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize tracked entities for a project."""

    mention_count = serializers.IntegerField(read_only=True)
    latest_mentions = serializers.SerializerMethodField()

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
            "mention_count",
            "latest_mentions",
            "created_at",
        ]
        read_only_fields = ["id", "project", "created_at"]

    def get_latest_mentions(self, obj):
        """Return a compact summary of the most recent mentions for an entity."""

        mentions = getattr(obj, "prefetched_mentions", None)
        if mentions is None:
            mentions = obj.mentions.select_related("content").order_by("-created_at")
        return EntityMentionSummarySerializer(mentions[:3], many=True).data


class EntityAuthoritySnapshotSerializer(serializers.ModelSerializer):
    """Serialize one persisted authority recomputation for an entity."""

    class Meta:
        model = EntityAuthoritySnapshot
        fields = [
            "id",
            "entity",
            "project",
            "computed_at",
            "mention_component",
            "feedback_component",
            "duplicate_component",
            "decayed_prior",
            "final_score",
        ]
        read_only_fields = fields


class TopicCentroidSnapshotSerializer(serializers.ModelSerializer):
    """Serialize one persisted topic-centroid recomputation for a project."""

    class Meta:
        model = TopicCentroidSnapshot
        fields = [
            "id",
            "project",
            "computed_at",
            "centroid_active",
            "feedback_count",
            "upvote_count",
            "downvote_count",
            "drift_from_previous",
            "drift_from_week_ago",
        ]
        read_only_fields = fields


class TopicCentroidObservabilitySummarySerializer(serializers.Serializer):
    """Serialize project-level centroid observability summary metrics."""

    project = serializers.IntegerField()
    snapshot_count = serializers.IntegerField()
    active_snapshot_count = serializers.IntegerField()
    avg_drift_from_previous = serializers.FloatField(allow_null=True)
    avg_drift_from_week_ago = serializers.FloatField(allow_null=True)
    latest_snapshot = TopicCentroidSnapshotSerializer(allow_null=True)


class EntityMentionSummarySerializer(serializers.ModelSerializer):
    """Serialize a compact entity-mention summary for frontend display."""

    content_id = serializers.IntegerField(read_only=True)
    content_title = serializers.CharField(source="content.title", read_only=True)

    class Meta:
        model = EntityMention
        fields = [
            "id",
            "content_id",
            "content_title",
            "role",
            "sentiment",
            "span",
            "confidence",
            "created_at",
        ]
        read_only_fields = fields


class EntityCandidateSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize extracted entity candidates awaiting editorial review."""

    first_seen_title = serializers.CharField(
        source="first_seen_in.title", read_only=True
    )
    merged_into_name = serializers.CharField(source="merged_into.name", read_only=True)

    class Meta:
        model = EntityCandidate
        fields = [
            "id",
            "project",
            "name",
            "suggested_type",
            "first_seen_in",
            "first_seen_title",
            "occurrence_count",
            "status",
            "merged_into",
            "merged_into_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class EntityCandidateMergeSerializer(
    ProjectScopedSerializerMixin, serializers.Serializer
):
    """Validate merge requests for entity candidates."""

    merged_into = serializers.PrimaryKeyRelatedField(queryset=Entity.objects.none())


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
