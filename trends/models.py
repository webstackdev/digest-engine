"""Trends-domain models for project observability and discovery workflows."""

import uuid

from django.conf import settings
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
        cluster_pk = self.cluster.pk
        return f"Velocity snapshot for cluster {cluster_pk}"


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
        content_pk = self.content.pk
        cluster_pk = self.cluster.pk
        return f"Content {content_pk} in cluster {cluster_pk}"


class ThemeSuggestionStatus(models.TextChoices):
    """Workflow states for generated theme suggestions."""

    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    DISMISSED = "dismissed", "Dismissed"
    USED = "used", "Used"


class ThemeSuggestion(models.Model):
    """Persist one editor-facing theme suggestion derived from a topic cluster."""

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="theme_suggestions",
    )
    cluster = models.ForeignKey(
        TopicCluster,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="theme_suggestions",
    )
    title = models.CharField(max_length=255)
    pitch = models.TextField()
    why_it_matters = models.TextField()
    suggested_angle = models.TextField(blank=True)
    velocity_at_creation = models.FloatField()
    novelty_score = models.FloatField()
    status = models.CharField(
        max_length=16,
        choices=ThemeSuggestionStatus.choices,
        default=ThemeSuggestionStatus.PENDING,
    )
    dismissal_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="decided_theme_suggestions",
    )

    class Meta:
        ordering = ["-created_at", "id"]
        db_table = "core_themesuggestion"
        indexes = [
            models.Index(fields=["project", "status", "-created_at"]),
            models.Index(fields=["project", "-velocity_at_creation"]),
        ]

    def __str__(self) -> str:
        return self.title


class SourceDiversitySnapshot(models.Model):
    """Capture one project-level source diversity reading for a rolling window."""

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="source_diversity_snapshots",
    )
    computed_at = models.DateTimeField(auto_now_add=True)
    window_days = models.PositiveIntegerField(default=14)
    plugin_entropy = models.FloatField()
    source_entropy = models.FloatField()
    author_entropy = models.FloatField()
    cluster_entropy = models.FloatField()
    top_plugin_share = models.FloatField()
    top_source_share = models.FloatField()
    breakdown = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-computed_at", "id"]
        db_table = "core_sourcediversitysnapshot"
        indexes = [
            models.Index(
                fields=["project", "-computed_at"],
                name="core_sourced_project_4bf5_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Source diversity snapshot for {self.project.name}"
