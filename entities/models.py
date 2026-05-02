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


class IdentitySurface(models.TextChoices):
    """Supported identity surfaces that can back an entity claim."""

    GITHUB = "github", "GitHub"
    LINKEDIN = "linkedin", "LinkedIn"
    BLUESKY = "bluesky", "Bluesky"
    MASTODON = "mastodon", "Mastodon"
    WEBSITE = "website", "Website"


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


class EntityIdentityClaim(models.Model):
    """Stores one resolved external identity claim for a tracked entity."""

    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name="identity_claims",
    )
    surface = models.CharField(max_length=32, choices=IdentitySurface.choices)
    claim_url = models.URLField()
    verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_method = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["surface", "claim_url"]
        db_table = "core_entityidentityclaim"
        constraints = [
            models.UniqueConstraint(
                fields=["entity", "surface", "claim_url"],
                name="core_entityidentityclaim_unique_entity_surface_url",
            )
        ]

    def __str__(self) -> str:
        return f"{self.entity.name} on {self.surface}"


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
    engagement_component = models.FloatField(default=0.0)
    recency_component = models.FloatField(default=0.0)
    source_quality_component = models.FloatField(default=0.0)
    cross_newsletter_component = models.FloatField(default=0.0)
    feedback_component = models.FloatField()
    duplicate_component = models.FloatField()
    decayed_prior = models.FloatField()
    weights_at_compute = models.JSONField(default=dict, blank=True)
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
        "content.Content", on_delete=models.CASCADE, related_name="entity_mentions"
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
        "content.Content",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="entity_candidates",
    )
    occurrence_count = models.IntegerField(default=1)
    cluster_key = models.CharField(max_length=64, blank=True, db_index=True)
    auto_promotion_blocked_reason = models.CharField(max_length=128, blank=True)
    contextual_embedding_id = models.UUIDField(null=True, blank=True)
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


class EntityCandidateEvidence(models.Model):
    """Captures one content-backed occurrence and identity hint for a candidate."""

    candidate = models.ForeignKey(
        EntityCandidate,
        on_delete=models.CASCADE,
        related_name="evidence",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="entity_candidate_evidence",
    )
    content = models.ForeignKey(
        "content.Content",
        on_delete=models.CASCADE,
        related_name="entity_candidate_evidence",
    )
    source_plugin = models.CharField(max_length=64)
    context_excerpt = models.TextField(blank=True)
    identity_surface = models.CharField(
        max_length=32,
        choices=IdentitySurface.choices,
        blank=True,
    )
    claim_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "core_entitycandidateevidence"
        constraints = [
            models.UniqueConstraint(
                fields=["candidate", "content"],
                name="core_entitycandidateevidence_unique_candidate_content",
            )
        ]
        indexes = [
            models.Index(
                fields=["candidate", "source_plugin"],
                name="core_entcand_candsrc_idx",
            ),
            models.Index(
                fields=["project", "created_at"],
                name="core_entcand_projtime_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.candidate.name} in {self.content.title}"
