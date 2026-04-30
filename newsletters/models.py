"""Newsletter-domain models split out from the historical core app."""

import secrets

from django.db import models


def generate_confirmation_token() -> str:
    """Generate a one-time token for newsletter sender confirmation links."""

    return secrets.token_urlsafe(24)


class NewsletterIntakeStatus(models.TextChoices):
    """Lifecycle states for a raw inbound newsletter email."""

    PENDING = "pending", "Pending"
    EXTRACTED = "extracted", "Extracted"
    FAILED = "failed", "Failed"
    REJECTED = "rejected", "Rejected"


class IntakeAllowlist(models.Model):
    """Tracks who is allowed to send newsletters into a project inbox."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="intake_allowlist"
    )
    sender_email = models.EmailField()
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmation_token = models.CharField(
        max_length=64, unique=True, default=generate_confirmation_token
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sender_email"]
        db_table = "core_intakeallowlist"
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
    """Stores a raw inbound newsletter email before extraction."""

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="newsletter_intakes",
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
        db_table = "core_newsletterintake"
        indexes = [
            models.Index(
                fields=["project", "sender_email", "status"],
                name="core_newsle_project_eee7a4_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.subject or self.message_id}"
