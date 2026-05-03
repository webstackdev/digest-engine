"""Application configuration for the notifications app."""

from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    """App config for persistent user-facing notifications."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"

    def ready(self) -> None:
        import notifications.signals  # noqa: F401
