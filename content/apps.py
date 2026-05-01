"""Django app configuration for the content domain."""

from django.apps import AppConfig


class ContentConfig(AppConfig):
    """Configure the content app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "content"

    def ready(self) -> None:
        import content.signals  # noqa: F401
