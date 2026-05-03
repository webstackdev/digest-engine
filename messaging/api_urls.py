"""API route registration for direct-message thread resources."""

from rest_framework.routers import DefaultRouter

from messaging.api import ThreadViewSet


def register_root_routes(router: DefaultRouter) -> None:
    """Register top-level messaging endpoints."""

    router.register("messaging/threads", ThreadViewSet, basename="messaging-thread")
