"""API route registration for top-level notification resources."""

from rest_framework.routers import DefaultRouter

from notifications.api import NotificationViewSet


def register_root_routes(router: DefaultRouter) -> None:
    """Register top-level current-user notification endpoints."""

    router.register("notifications", NotificationViewSet, basename="notification")
