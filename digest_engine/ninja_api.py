"""Project-level Django Ninja API registration."""

from ninja import NinjaAPI

from core.ninja_api import register_drf_exception_handlers
from messaging.ninja_api import router as messaging_router
from notifications.ninja_api import router as notifications_router
from projects.ninja_api import router as projects_router
from users.ninja_api import router as users_router

api = NinjaAPI(
    title="Digest Engine Ninja API",
    version="1.0.0",
    urls_namespace="ninja-api",
)
register_drf_exception_handlers(api)
api.add_router("/v1", users_router)
api.add_router("/v1", notifications_router)
api.add_router("/v1", messaging_router)
api.add_router("/v1", projects_router)

__all__ = ["api"]
