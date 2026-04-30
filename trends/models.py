"""Trends-domain models for project observability and discovery workflows."""

import uuid

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


class TopicCluster(models.Model):
    """Represent one project-scoped topic cluster over recent active content."""

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="topic_clusters",
    )
    centroid_vector_id = models.UUIDField(default=uuid.uuid4, unique=True)
    label = models.CharField(max_length=255, blank=True)
    first_seen_at = models.DateTimeField()
    last_seen_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    member_count = models.PositiveIntegerField(default=0)
    dominant_entity = models.ForeignKey(
        "entities.Entity",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="dominant_topic_clusters",
    )

    class Meta:
        ordering = ["-last_seen_at", "id"]
        db_table = "core_topiccluster"
        indexes = [
            models.Index(fields=["project", "-last_seen_at"]),
            models.Index(fields=["project", "is_active", "-last_seen_at"]),
        ]

    def __str__(self) -> str:
        return self.label or f"Topic cluster {self.pk}"


class TopicVelocitySnapshot(models.Model):
    """Capture one computed velocity reading for an active topic cluster."""

    cluster = models.ForeignKey(
        TopicCluster,
        on_delete=models.CASCADE,
        related_name="velocity_snapshots",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="topic_velocity_snapshots",
    )
    computed_at = models.DateTimeField(auto_now_add=True)
    window_count = models.PositiveIntegerField()
    trailing_mean = models.FloatField()
    trailing_stddev = models.FloatField()
    z_score = models.FloatField()
    velocity_score = models.FloatField()

    class Meta:
        ordering = ["-computed_at", "id"]
        db_table = "core_topicvelocitysnapshot"
        indexes = [
            models.Index(fields=["project", "-computed_at"]),
            models.Index(fields=["cluster", "-computed_at"]),
        ]

    def __str__(self) -> str:
        return f"Velocity snapshot for cluster {self.cluster_id}"


class ContentClusterMembership(models.Model):
    """Record one content item's current assignment to a topic cluster."""

    content = models.ForeignKey(
        "content.Content",
        on_delete=models.CASCADE,
        related_name="cluster_memberships",
    )
    cluster = models.ForeignKey(
        TopicCluster,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="content_cluster_memberships",
    )
    similarity = models.FloatField()
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-assigned_at", "id"]
        db_table = "core_contentclustermembership"
        constraints = [
            models.UniqueConstraint(
                fields=["content", "cluster"],
                name="core_contentcluster_unique_content_cluster",
            )
        ]
        indexes = [
            models.Index(fields=["cluster", "-assigned_at"]),
            models.Index(fields=["project", "content"]),
        ]

    def __str__(self) -> str:
        return f"Content {self.content_id} in cluster {self.cluster_id}"
