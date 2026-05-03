"""Persistent notification records for the user-facing inbox."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class NotificationLevel(models.TextChoices):
    """Supported severity levels for frontend notification rendering."""

    INFO = "info", "Info"
    SUCCESS = "success", "Success"
    ERROR = "error", "Error"


class Notification(models.Model):
    """Persist one user-facing notification emitted by backend workflows."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    level = models.CharField(
        max_length=16,
        choices=NotificationLevel.choices,
        default=NotificationLevel.INFO,
    )
    body = models.CharField(max_length=512)
    link_path = models.CharField(max_length=512, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "read_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user}: {self.level} - {self.body[:40]}"

    @property
    def is_read(self) -> bool:
        """Return whether the notification has been marked as read."""

        return self.read_at is not None
