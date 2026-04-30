"""Entity-domain models split out from the historical core app."""

from __future__ import annotations

from django.db import models


class EntityType(models.TextChoices):
    """Supported types of tracked entities within a project."""

    INDIVIDUAL = "individual", "Individual"
    VENDOR = "vendor", "Vendor"
    ORGANIZATION = "organization", "Organization"


class EntityMentionRole(models.TextChoices):
    """Supported roles for how an entity appears inside content."""

    AUTHOR = "author", "Author"
    SUBJECT = "subject", "Subject"
    QUOTED = "quoted", "Quoted"
    MENTIONED = "mentioned", "Mentioned"


class EntityMentionSentiment(models.TextChoices):
    """Supported editorial sentiment labels for entity mentions."""

    POSITIVE = "positive", "Positive"
    NEUTRAL = "neutral", "Neutral"
    NEGATIVE = "negative", "Negative"


class EntityCandidateStatus(models.TextChoices):
    """Review workflow states for extracted entity candidates."""

    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    MERGED = "merged", "Merged"


class Entity(models.Model):
    """Represents a person, vendor, or organization tracked inside a project."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="entities"
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=32, choices=EntityType.choices)
    description = models.TextField(blank=True)
    authority_score = models.FloatField(default=0.5)
    website_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    linkedin_url = models.URLField(blank=True)
    bluesky_handle = models.CharField(max_length=255, blank=True)
    mastodon_handle = models.CharField(max_length=255, blank=True)
    twitter_handle = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        db_table = "core_entity"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"], name="core_entity_unique_project_name"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class EntityAuthoritySnapshot(models.Model):
    """Captures one authority-score recomputation for a tracked entity."""

    entity = models.ForeignKey(
        Entity, on_delete=models.CASCADE, related_name="authority_snapshots"
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="entity_authority_snapshots",
    )
    computed_at = models.DateTimeField(auto_now_add=True)
    mention_component = models.FloatField()
    feedback_component = models.FloatField()
    duplicate_component = models.FloatField()
    decayed_prior = models.FloatField()
    final_score = models.FloatField()

    class Meta:
        ordering = ["-computed_at"]
        db_table = "core_entityauthoritysnapshot"
        indexes = [
            models.Index(
                fields=["entity", "-computed_at"],
                name="core_entity_entity__9fe820_idx",
            ),
            models.Index(
                fields=["project", "-computed_at"],
                name="core_entity_project_a31e41_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Authority snapshot for {self.entity.name}"


class EntityMention(models.Model):
    """Represents one tracked-entity mention detected in a content item."""

    content = models.ForeignKey(
        "core.Content", on_delete=models.CASCADE, related_name="entity_mentions"
    )
    entity = models.ForeignKey(
        Entity, on_delete=models.CASCADE, related_name="mentions"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="entity_mentions"
    )
    role = models.CharField(max_length=16, choices=EntityMentionRole.choices)
    sentiment = models.CharField(
        max_length=16,
        choices=EntityMentionSentiment.choices,
        blank=True,
        default="",
    )
    span = models.TextField(blank=True)
    confidence = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "core_entitymention"
        constraints = [
            models.UniqueConstraint(
                fields=["content", "entity", "role"],
                name="core_entitymention_unique_content_entity_role",
            )
        ]
        indexes = [
            models.Index(
                fields=["entity", "created_at"],
                name="core_entity_entity__8ba01e_idx",
            ),
            models.Index(
                fields=["project", "created_at"],
                name="core_entity_project_dabde7_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.entity.name} in {self.content.title}"


class EntityCandidate(models.Model):
    """Stores an extracted named entity awaiting human confirmation."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="entity_candidates"
    )
    name = models.CharField(max_length=255)
    suggested_type = models.CharField(max_length=32, choices=EntityType.choices)
    first_seen_in = models.ForeignKey(
        "core.Content",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="entity_candidates",
    )
    occurrence_count = models.IntegerField(default=1)
    status = models.CharField(
        max_length=16,
        choices=EntityCandidateStatus.choices,
        default=EntityCandidateStatus.PENDING,
    )
    merged_into = models.ForeignKey(
        Entity,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="merged_entity_candidates",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-occurrence_count", "name"]
        db_table = "core_entitycandidate"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                name="core_entitycandidate_unique_project_name",
            )
        ]
        indexes = [
            models.Index(
                fields=["project", "status", "occurrence_count"],
                name="core_entity_project_4c32ec_idx",
            ),
        ]

    def __str__(self) -> str:
        return self.name
