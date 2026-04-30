"""DRF serializers for trends-domain models."""

from rest_framework import serializers

from trends.models import (
    ContentClusterMembership,
    TopicCentroidSnapshot,
    TopicCluster,
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
