"""Models for direct user-to-user messaging threads and messages."""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings
from django.db import models
from django.db.models import Count

from projects.models import ProjectMembership

if TYPE_CHECKING:
    from users.models import AppUser


def shared_project_ids_for_users(first_user_id: int, second_user_id: int) -> list[int]:
    """Return the project ids visible to both users."""

    return list(
        ProjectMembership.objects.filter(user_id=first_user_id)
        .filter(project__memberships__user_id=second_user_id)
        .values_list("project_id", flat=True)
        .distinct()
    )


def users_share_project(first_user_id: int, second_user_id: int) -> bool:
    """Return whether both users share at least one project membership."""

    return bool(shared_project_ids_for_users(first_user_id, second_user_id))


class Thread(models.Model):
    """A 1:1 direct-message thread between two users."""

    participants: models.ManyToManyField[AppUser, ThreadParticipant] = (
        models.ManyToManyField(
            settings.AUTH_USER_MODEL,
            through="ThreadParticipant",
            related_name="threads",
        )
    )
    last_message_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]

    def __str__(self) -> str:
        return f"Thread {self.pk}"

    @classmethod
    def find_between_users(
        cls, first_user_id: int, second_user_id: int
    ) -> "Thread | None":
        """Return the existing 1:1 thread shared by the two users, if any."""

        return (
            cls.objects.filter(participants__id=first_user_id)
            .filter(participants__id=second_user_id)
            .annotate(participant_count=Count("participants", distinct=True))
            .filter(participant_count=2)
            .first()
        )


class ThreadParticipant(models.Model):
    """Per-user thread state such as last read timestamps."""

    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        related_name="participant_states",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="thread_states",
    )
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["thread", "user"],
                name="messaging_threadparticipant_unique_thread_user",
            )
        ]
        indexes = [models.Index(fields=["user", "thread"])]

    def __str__(self) -> str:
        return f"{self.user} in thread {self.thread_id}"


class DirectMessage(models.Model):
    """One message authored by one participant in a thread."""

    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="messages_sent",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return f"Message {self.pk} in thread {self.thread_id}"
