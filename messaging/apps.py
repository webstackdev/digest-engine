"""App configuration for the messaging app."""

from django.apps import AppConfig


class MessagingConfig(AppConfig):
    """Configure the messaging app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "messaging"
    verbose_name = "Messaging"

    def ready(self) -> None:
        import messaging.signals  # noqa: F401
