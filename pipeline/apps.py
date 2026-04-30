"""Django app configuration for the pipeline domain."""

from django.apps import AppConfig


class PipelineConfig(AppConfig):
    """Configure the pipeline app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "pipeline"