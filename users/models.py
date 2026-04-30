"""Custom user model and profile fields for the users app."""

from __future__ import annotations

from typing import ClassVar

from django.contrib.auth.models import AbstractUser, Group, Permission
from django.db import models

from users.managers import AppUserManager


def avatar_upload_path(instance: "AppUser", filename: str) -> str:
    """Return the storage path used for uploaded profile avatars."""

    user_id = instance.pk or "pending"
    return f"avatars/{user_id}/{filename}"


class AppUser(AbstractUser):
    """Project-aware application user with profile fields.

    The model deliberately reuses Django's historical auth tables so the current
    Group-based project scoping and third-party auth integrations remain valid
    while the package refactor introduces the dedicated users app.
    """

    display_name = models.CharField(max_length=120, blank=True)
    avatar = models.ImageField(upload_to=avatar_upload_path, blank=True, null=True)
    bio = models.TextField(blank=True)
    timezone = models.CharField(max_length=64, blank=True, default="UTC")
    groups = models.ManyToManyField(  # type: ignore[assignment]
        Group,
        verbose_name="groups",
        blank=True,
        related_name="user_set",
        related_query_name="user",
        help_text=(
            "The groups this user belongs to. A user will get all permissions "
            "granted to each of their groups."
        ),
        db_table="auth_user_groups",
    )
    user_permissions = models.ManyToManyField(  # type: ignore[assignment]
        Permission,
        verbose_name="user permissions",
        blank=True,
        help_text="Specific permissions for this user.",
        related_name="user_set",
        related_query_name="user",
        db_table="auth_user_user_permissions",
    )

    objects: ClassVar[AppUserManager] = AppUserManager()

    class Meta:
        db_table = "auth_user"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self) -> str:
        return self.display_name or self.get_username()
