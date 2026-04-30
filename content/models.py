"""Content-domain models split out from the historical core app."""

from django.conf import settings
from django.db import models


class FeedbackType(models.TextChoices):
    """Editorial feedback signals that tune authority and ranking."""

    UPVOTE = "upvote", "Upvote"
    DOWNVOTE = "downvote", "Downvote"


class Content(models.Model):
    """Stores an ingested content item that may appear in a newsletter."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="contents"
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
        db_table = "core_content"
        indexes = [
            models.Index(fields=["project", "-published_date"]),
            models.Index(fields=["project", "-relevance_score"]),
            models.Index(fields=["project", "-authority_adjusted_score"]),
            models.Index(fields=["project", "is_reference"]),
            models.Index(fields=["url"]),
        ]

    def __str__(self) -> str:
        return self.title


class UserFeedback(models.Model):
    """Records an editor's feedback on a specific content item."""

    content = models.ForeignKey(
        Content, on_delete=models.CASCADE, related_name="feedback"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="feedback"
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
        db_table = "core_userfeedback"
        constraints = [
            models.UniqueConstraint(
                fields=["content", "user"],
                name="core_feedback_unique_content_user",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.feedback_type} by {self.user}"
