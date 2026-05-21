"""Project-level Django Ninja API registration."""

from ninja import NinjaAPI

from messaging.ninja_api import router as messaging_router
from notifications.ninja_api import router as notifications_router
from projects.ninja_api import router as projects_router
from users.ninja_api import router as users_router


def _build_api(*, urls_namespace: str) -> NinjaAPI:
    """Create one Ninja API instance with the shared Digest Engine routers."""

    api = NinjaAPI(
        title="Digest Engine Ninja API",
        version="1.0.0",
        urls_namespace=urls_namespace,
    )
    api.add_router("/v1", users_router)
    api.add_router("/v1", notifications_router)
    api.add_router("/v1", messaging_router)
    api.add_router("/v1", projects_router)
    return api


api = _build_api(urls_namespace="ninja-api")
legacy_api = _build_api(urls_namespace="legacy-ninja-api")

__all__ = ["api", "legacy_api"]
