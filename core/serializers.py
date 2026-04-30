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
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityMention,
    IngestionRun,
    IntakeAllowlist,
    NewsletterIntake,
    ReviewQueue,
    SkillResult,
    TopicCentroidSnapshot,
    UserFeedback,
)
from core.permissions import get_visible_projects_queryset


class ProjectScopedSerializerMixin:
    """Limit serializer relationship fields to objects the current user can access."""

    def _filter_related_queryset(self, request):
        """Constrain related-field querysets using the request user and project context."""

        user = request.user
        project = self.context.get("project")
        if "group" in self.fields:
            self.fields["group"].queryset = Group.objects.filter(user=user)
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
