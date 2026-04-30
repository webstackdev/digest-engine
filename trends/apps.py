"""Django app configuration for the trends domain."""

from django.apps import AppConfig


class TrendsConfig(AppConfig):
    """Configure the trends app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "trends"
