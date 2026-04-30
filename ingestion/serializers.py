"""DRF serializers for ingestion-domain models."""

from rest_framework import serializers

from core.serializers import ProjectScopedSerializerMixin
from ingestion.models import IngestionRun


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
