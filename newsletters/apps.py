"""Django app configuration for the newsletters domain."""

from django.apps import AppConfig


class NewslettersConfig(AppConfig):
    """Configure the newsletters app and register its signal handlers."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "newsletters"

    def ready(self) -> None:
        import newsletters.signals  # noqa: F401
