"""DRF serializers for trends-domain models."""

from rest_framework import serializers

from content.models import Content
from core.serializer_mixins import ProjectScopedSerializerMixin
from trends.models import (
    ContentClusterMembership,
    OriginalContentIdea,
    OriginalContentIdeaStatus,
    SourceDiversitySnapshot,
    ThemeSuggestion,
    ThemeSuggestionStatus,
    TopicCentroidSnapshot,
    TopicCluster,
    TrendTaskRun,
    TopicVelocitySnapshot,
)


class TopicClusterEntitySerializer(serializers.Serializer):
    """Serialize the dominant entity summary for a topic cluster."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    type = serializers.CharField()


class TopicClusterContentSummarySerializer(serializers.Serializer):
    """Serialize the content fields surfaced on cluster detail responses."""

    id = serializers.IntegerField()
    url = serializers.URLField()
    title = serializers.CharField()
    published_date = serializers.DateTimeField()
    source_plugin = serializers.CharField()


class ContentClusterMembershipSerializer(serializers.ModelSerializer):
    """Serialize one content membership within a topic cluster."""

    content = TopicClusterContentSummarySerializer(read_only=True)

    class Meta:
        model = ContentClusterMembership
        fields = ["id", "content", "similarity", "assigned_at"]
        read_only_fields = fields


class TopicVelocitySnapshotSerializer(serializers.ModelSerializer):
    """Serialize one persisted topic velocity snapshot."""

    class Meta:
        model = TopicVelocitySnapshot
        fields = [
            "id",
            "cluster",
            "project",
            "computed_at",
            "window_count",
            "trailing_mean",
            "trailing_stddev",
            "z_score",
            "velocity_score",
        ]
        read_only_fields = fields


class TopicClusterSerializer(serializers.ModelSerializer):
    """Serialize one topic cluster with its current velocity rollup."""

    dominant_entity = TopicClusterEntitySerializer(read_only=True)
    velocity_score = serializers.FloatField(read_only=True, allow_null=True)
    z_score = serializers.FloatField(read_only=True, allow_null=True)
    window_count = serializers.IntegerField(read_only=True, allow_null=True)
    velocity_computed_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = TopicCluster
        fields = [
            "id",
            "project",
            "centroid_vector_id",
            "label",
            "first_seen_at",
            "last_seen_at",
            "is_active",
            "member_count",
            "dominant_entity",
            "velocity_score",
            "z_score",
            "window_count",
            "velocity_computed_at",
        ]
        read_only_fields = fields


class TopicClusterDetailSerializer(TopicClusterSerializer):
    """Serialize one topic cluster with memberships and snapshot history."""

    memberships = ContentClusterMembershipSerializer(many=True, read_only=True)
    velocity_history = TopicVelocitySnapshotSerializer(
        many=True,
        read_only=True,
        source="velocity_snapshots",
    )

    class Meta(TopicClusterSerializer.Meta):
        fields = TopicClusterSerializer.Meta.fields + [
            "memberships",
            "velocity_history",
        ]


class ThemeSuggestionClusterSummarySerializer(serializers.Serializer):
    """Serialize the cluster summary embedded in theme suggestions."""

    id = serializers.IntegerField()
    label = serializers.CharField(allow_blank=True)
    member_count = serializers.IntegerField()
    velocity_score = serializers.FloatField(read_only=True, allow_null=True)


class ThemeSuggestionPromotedContentSerializer(serializers.ModelSerializer):
    """Serialize one content row marked for newsletter promotion by a theme."""

    class Meta:
        model = Content
        fields = [
            "id",
            "url",
            "title",
            "published_date",
            "source_plugin",
            "newsletter_promotion_at",
        ]
        read_only_fields = fields


class ThemeSuggestionSerializer(serializers.ModelSerializer):
    """Serialize one editor-facing theme suggestion."""

    cluster = ThemeSuggestionClusterSummarySerializer(read_only=True)
    promoted_contents = ThemeSuggestionPromotedContentSerializer(
        many=True, read_only=True
    )
    decided_by_username = serializers.CharField(
        source="decided_by.username",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = ThemeSuggestion
        fields = [
            "id",
            "project",
            "cluster",
            "title",
            "pitch",
            "why_it_matters",
            "suggested_angle",
            "velocity_at_creation",
            "novelty_score",
            "status",
            "dismissal_reason",
            "created_at",
            "decided_at",
            "decided_by",
            "decided_by_username",
            "promoted_contents",
        ]
        read_only_fields = fields


class ThemeSuggestionDismissSerializer(
    ProjectScopedSerializerMixin, serializers.Serializer
):
    """Validate dismissal requests for pending theme suggestions."""

    reason = serializers.CharField(max_length=500)

    def validate_reason(self, value: str) -> str:
        """Reject blank dismissal reasons."""

        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Dismissal reason cannot be blank.")
        return normalized


class OriginalContentIdeaClusterSummarySerializer(serializers.Serializer):
    """Serialize the related cluster summary embedded in original-content ideas."""

    id = serializers.IntegerField()
    label = serializers.CharField(allow_blank=True)
    member_count = serializers.IntegerField()


class OriginalContentIdeaSupportingContentSerializer(serializers.ModelSerializer):
    """Serialize one supporting content row linked to an original-content idea."""

    class Meta:
        model = Content
        fields = ["id", "url", "title", "published_date", "source_plugin"]
        read_only_fields = fields


class OriginalContentIdeaSerializer(serializers.ModelSerializer):
    """Serialize one editor-facing original-content idea."""

    related_cluster = OriginalContentIdeaClusterSummarySerializer(read_only=True)
    supporting_contents = OriginalContentIdeaSupportingContentSerializer(
        many=True,
        read_only=True,
    )
    decided_by_username = serializers.CharField(
        source="decided_by.username",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = OriginalContentIdea
        fields = [
            "id",
            "project",
            "angle_title",
            "summary",
            "suggested_outline",
            "why_now",
            "supporting_contents",
            "related_cluster",
            "generated_by_model",
            "self_critique_score",
            "status",
            "dismissal_reason",
            "created_at",
            "decided_at",
            "decided_by",
            "decided_by_username",
        ]
        read_only_fields = fields


class OriginalContentIdeaDismissSerializer(
    ProjectScopedSerializerMixin, serializers.Serializer
):
    """Validate dismissal requests for pending original-content ideas."""

    reason = serializers.CharField(max_length=500)

    def validate_reason(self, value: str) -> str:
        """Reject blank dismissal reasons."""

        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Dismissal reason cannot be blank.")
        return normalized


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


class SourceDiversitySnapshotSerializer(serializers.ModelSerializer):
    """Serialize one persisted source-diversity snapshot for a project."""

    class Meta:
        model = SourceDiversitySnapshot
        fields = [
            "id",
            "project",
            "computed_at",
            "window_days",
            "plugin_entropy",
            "source_entropy",
            "author_entropy",
            "cluster_entropy",
            "top_plugin_share",
            "top_source_share",
            "breakdown",
        ]
        read_only_fields = fields


class SourceDiversityObservabilitySummarySerializer(serializers.Serializer):
    """Serialize project-level source-diversity observability metrics."""

    project = serializers.IntegerField()
    snapshot_count = serializers.IntegerField()
    latest_snapshot = SourceDiversitySnapshotSerializer(allow_null=True)


class TrendTaskRunSerializer(serializers.ModelSerializer):
    """Serialize one persisted trend pipeline task execution."""

    class Meta:
        model = TrendTaskRun
        fields = [
            "id",
            "project",
            "task_name",
            "task_run_id",
            "status",
            "started_at",
            "finished_at",
            "latency_ms",
            "error_message",
            "summary",
        ]
        read_only_fields = fields


class TrendTaskRunObservabilitySummarySerializer(serializers.Serializer):
    """Serialize the latest trend task runs plus project-level rollup counts."""

    project = serializers.IntegerField()
    run_count = serializers.IntegerField()
    failed_run_count = serializers.IntegerField()
    latest_runs = TrendTaskRunSerializer(many=True)
