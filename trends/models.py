"""Trends-domain models for project observability and discovery workflows."""

from django.db import models


class TopicCentroidSnapshot(models.Model):
    """Capture one recomputed topic-centroid state for a project."""

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="topic_centroid_snapshots",
    )
    computed_at = models.DateTimeField(auto_now_add=True)
    centroid_active = models.BooleanField(default=False)
    centroid_vector = models.JSONField(default=list, blank=True)
    feedback_count = models.PositiveIntegerField(default=0)
    upvote_count = models.PositiveIntegerField(default=0)
    downvote_count = models.PositiveIntegerField(default=0)
    drift_from_previous = models.FloatField(null=True, blank=True)
    drift_from_week_ago = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["-computed_at"]
        db_table = "core_topiccentroidsnapshot"
        indexes = [
            models.Index(
                fields=["project", "-computed_at"],
                name="core_topicc_project_2e2c18_idx",
            ),
            models.Index(
                fields=["project", "centroid_active", "-computed_at"],
                name="core_topicc_project_6b2dd8_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Topic centroid snapshot for {self.project.name}"
