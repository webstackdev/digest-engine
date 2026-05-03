"""DRF serializers for pipeline-domain models."""

from rest_framework import serializers

from core.serializer_mixins import ProjectScopedSerializerMixin
from pipeline.models import ReviewQueue, SkillResult


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
            "invocation_id",
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
            "failed_node",
            "failure_detail",
            "skill_invocation_id",
            "created_at",
            "resolved",
            "resolved_at",
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
