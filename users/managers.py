"""Managers for the custom application user model."""

from django.contrib.auth.models import UserManager


class AppUserManager(UserManager):
    """Future home for custom user creation behavior."""
