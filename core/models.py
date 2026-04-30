"""Core domain models for ingestion, editorial review, and shared enums.

The admin, API, Celery tasks, and AI pipeline all revolve around the models in this
module. Adding model-level docstrings here gives Django admindocs a useful summary
of the core entities new contributors interact with first.
"""

import secrets

from django.conf import settings
from django.db import models

from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityCandidateStatus,
    EntityMention,
    EntityMentionRole,
    EntityMentionSentiment,
    EntityType,
)
from projects.models import Project

__all__ = [
    "Entity",
    "EntityAuthoritySnapshot",
    "EntityCandidate",
    "EntityCandidateStatus",
    "EntityMention",
    "EntityMentionRole",
    "EntityMentionSentiment",
    "EntityType",
]


def generate_project_intake_token() -> str:
    """Generate the stable token used in project-specific intake email aliases.

    Returns:
        A random hex token that can be embedded in addresses like
        ``intake+<token>@...`` to route inbound newsletters to a project.
    """

    from projects.model_support import generate_project_intake_token as _generate_token

    return _generate_token()


def generate_confirmation_token() -> str:
    """Generate a one-time token for newsletter sender confirmation links.

    Returns:
        A URL-safe random token stored on an allowlist entry until the sender
        confirms newsletter intake access.
    """

    return secrets.token_urlsafe(24)


def normalize_bluesky_handle(handle: str) -> str:
    """Normalize Bluesky handles so stored account references stay consistent."""

    from projects.model_support import normalize_bluesky_handle as _normalize_handle

    return _normalize_handle(handle)


def normalize_bluesky_pds_url(pds_url: str) -> str:
    """Normalize a user-provided PDS URL to its base host form."""

    from projects.model_support import normalize_bluesky_pds_url as _normalize_pds_url

    return _normalize_pds_url(pds_url)


def _bluesky_credentials_fernet():
    """Build the symmetric cipher used for Bluesky app-password storage."""

    from projects.model_support import bluesky_credentials_fernet

    return bluesky_credentials_fernet()


class SkillStatus(models.TextChoices):
    """Execution states recorded for AI skill runs."""

    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class FeedbackType(models.TextChoices):
    """Editorial feedback signals that tune authority and ranking."""

    UPVOTE = "upvote", "Upvote"
    DOWNVOTE = "downvote", "Downvote"


class NewsletterIntakeStatus(models.TextChoices):
    """Lifecycle states for a raw inbound newsletter email."""

    PENDING = "pending", "Pending"
    EXTRACTED = "extracted", "Extracted"
    FAILED = "failed", "Failed"
    REJECTED = "rejected", "Rejected"


class RunStatus(models.TextChoices):
    """Outcome states for ingestion runs."""

    RUNNING = "running", "Running"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"


class ReviewReason(models.TextChoices):
    """Reasons content is pushed to the manual review queue."""

    LOW_CONFIDENCE_CLASSIFICATION = (
        "low_confidence_classification",
        "Low Confidence Classification",
    )
    BORDERLINE_RELEVANCE = "borderline_relevance", "Borderline Relevance"


class ReviewResolution(models.TextChoices):
    """Human outcomes for review queue items."""

    HUMAN_APPROVED = "human_approved", "Human Approved"
    HUMAN_REJECTED = "human_rejected", "Human Rejected"


class TopicCentroidSnapshot(models.Model):
    """Captures one recomputed topic-centroid state for a project.

    Snapshot rows preserve the normalized centroid vector and enough derived drift
    metadata to support future admin widgets without querying historical vectors
    back out of Qdrant.
    """

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="topic_centroid_snapshots"
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
        indexes = [
            models.Index(fields=["project", "-computed_at"]),
            models.Index(fields=["project", "centroid_active", "-computed_at"]),
        ]

    def __str__(self) -> str:
        return f"Topic centroid snapshot for {self.project.name}"


class Content(models.Model):
    """Stores an ingested content item that may appear in a newsletter.

    A content row is the canonical record for fetched articles, newsletter links,
    or other source items. It keeps the raw text used for embedding, skill output,
    editorial review, duplicate tracking, and it also links the row to its Qdrant
    vector via ``embedding_id``.
    """

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="contents"
    )
    url = models.URLField()
    title = models.CharField(max_length=512)
    author = models.CharField(max_length=255, blank=True)
    entity = models.ForeignKey(
        "entities.Entity",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="contents",
    )
    source_plugin = models.CharField(max_length=64)
    content_type = models.CharField(max_length=64, blank=True)
    canonical_url = models.URLField(blank=True, default="", db_index=True)
    published_date = models.DateTimeField()
    ingested_at = models.DateTimeField(auto_now_add=True)
    content_text = models.TextField()
    relevance_score = models.FloatField(null=True, blank=True)
    authority_adjusted_score = models.FloatField(null=True, blank=True)
    embedding_id = models.CharField(max_length=64, blank=True)
    source_metadata = models.JSONField(default=dict, blank=True)
    duplicate_of = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="duplicates",
    )
    duplicate_signal_count = models.IntegerField(default=0)
    is_reference = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-published_date"]
        indexes = [
            models.Index(fields=["project", "-published_date"]),
            models.Index(fields=["project", "-relevance_score"]),
            models.Index(fields=["project", "-authority_adjusted_score"]),
            models.Index(fields=["project", "is_reference"]),
            models.Index(fields=["url"]),
        ]

    def __str__(self) -> str:
        return self.title


class IntakeAllowlist(models.Model):
    """Tracks who is allowed to send newsletters into a project inbox.

    When the first message arrives from a sender, the system creates an allowlist
    entry and emails a confirmation link. After confirmation, future inbound
    messages from the same sender can be processed automatically.
    """

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="intake_allowlist"
    )
    sender_email = models.EmailField()
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmation_token = models.CharField(
        max_length=64, unique=True, default=generate_confirmation_token
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sender_email"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "sender_email"],
                name="core_allowlist_unique_project_sender",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sender_email} for {self.project.name}"

    @property
    def is_confirmed(self) -> bool:
        """Return whether the sender has confirmed newsletter intake access."""

        return self.confirmed_at is not None


class NewsletterIntake(models.Model):
    """Stores a raw inbound newsletter email before extraction.

    Intake rows preserve the original email payload, deduplicate by message ID,
    and record whether extraction succeeded so the system can reprocess or audit
    inbound newsletter handling later.
    """

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="newsletter_intakes"
    )
    sender_email = models.EmailField()
    subject = models.CharField(max_length=512)
    received_at = models.DateTimeField(auto_now_add=True)
    raw_html = models.TextField(blank=True)
    raw_text = models.TextField(blank=True)
    message_id = models.CharField(max_length=255, unique=True)
    status = models.CharField(
        max_length=16,
        choices=NewsletterIntakeStatus.choices,
        default=NewsletterIntakeStatus.PENDING,
    )
    extraction_result = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["project", "sender_email", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.subject or self.message_id}"


class SkillResult(models.Model):
    """Persists the output of one AI skill execution for a content item.

    Skill results provide an auditable history of classifications, relevance
    scores, summaries, and related-content lookups, including model metadata,
    latency, and any superseded reruns.
    """

    content = models.ForeignKey(
        Content, on_delete=models.CASCADE, related_name="skill_results"
    )
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="skill_results"
    )
    skill_name = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=SkillStatus.choices)
    result_data = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    model_used = models.CharField(max_length=64, blank=True)
    latency_ms = models.IntegerField(null=True, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    superseded_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="supersedes",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["content", "skill_name"]),
            models.Index(fields=["project", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.skill_name} for {self.content.title}"


class UserFeedback(models.Model):
    """Records an editor's feedback on a specific content item.

    Feedback is stored separately from the content row so the application can use
    it as an explicit human signal when adjusting ranking and authority logic.
    """

    content = models.ForeignKey(
        Content, on_delete=models.CASCADE, related_name="feedback"
    )
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="feedback"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="content_feedback",
    )
    feedback_type = models.CharField(max_length=16, choices=FeedbackType.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["content", "user"], name="core_feedback_unique_content_user"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.feedback_type} by {self.user}"


class IngestionRun(models.Model):
    """Captures the outcome of one source-ingestion execution.

    Run rows make ingestion observable in the admin by recording the source,
    timestamps, item counts, and any error that stopped the fetch.
    """

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="ingestion_runs"
    )
    plugin_name = models.CharField(max_length=64)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=RunStatus.choices)
    items_fetched = models.IntegerField(default=0)
    items_ingested = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["project", "plugin_name", "-started_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.plugin_name} for {self.project.name}"


class ReviewQueue(models.Model):
    """Tracks content items that require a human decision.

    The AI pipeline adds rows here when classification confidence is low or the
    relevance score is borderline. Review outcomes are stored on the queue item so
    editors can see why an article was escalated and how it was resolved.
    """

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="review_queue_items"
    )
    content = models.ForeignKey(
        Content, on_delete=models.CASCADE, related_name="review_queue_items"
    )
    reason = models.CharField(max_length=64, choices=ReviewReason.choices)
    confidence = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)
    resolution = models.CharField(
        max_length=64, choices=ReviewResolution.choices, blank=True
    )

    class Meta:
        ordering = ["resolved", "-created_at"]

    def __str__(self) -> str:
        return f"{self.reason} for {self.content.title}"
