"""Django app configuration for the ingestion domain."""

from django.apps import AppConfig


class IngestionConfig(AppConfig):
    """Configure the ingestion app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "ingestion"