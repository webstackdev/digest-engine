"""DRF serializers for trends-domain models."""

from rest_framework import serializers

from trends.models import TopicCentroidSnapshot


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
