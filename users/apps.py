"""Application configuration for the users app."""

from django.apps import AppConfig


class UsersConfig(AppConfig):
    """App config for the custom user and profile foundation."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "users"
