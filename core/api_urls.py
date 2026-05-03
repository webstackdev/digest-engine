"""Aggregate app-owned API route registrations under the public v1 surface."""

from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedSimpleRouter

from content.api_urls import register_project_routes as register_content_project_routes
from entities.api_urls import (
    register_project_routes as register_entities_project_routes,
)
from ingestion.api_urls import (
    register_project_routes as register_ingestion_project_routes,
)
from messaging.api_urls import register_root_routes as register_messaging_root_routes
from newsletters.api_urls import (
    register_project_routes as register_newsletters_project_routes,
)
from notifications.api_urls import (
    register_root_routes as register_notifications_root_routes,
)
from pipeline.api_urls import (
    register_project_routes as register_pipeline_project_routes,
)
from projects.api_urls import (
    register_project_routes as register_projects_project_routes,
)
from projects.api_urls import (
    register_root_routes as register_projects_root_routes,
)
from projects.linkedin_oauth import linkedin_oauth_callback_view
from trends.api_urls import register_project_routes as register_trends_project_routes

app_name = "api"

router = DefaultRouter()
register_projects_root_routes(router)
register_notifications_root_routes(router)
register_messaging_root_routes(router)

project_router = NestedSimpleRouter(router, r"projects", lookup="project")
register_projects_project_routes(project_router)
register_entities_project_routes(project_router)
register_content_project_routes(project_router)
register_pipeline_project_routes(project_router)
register_ingestion_project_routes(project_router)
register_newsletters_project_routes(project_router)
register_trends_project_routes(project_router)

urlpatterns = [
    path(
        "linkedin/oauth/callback/",
        linkedin_oauth_callback_view,
        name="linkedin-oauth-callback",
    ),
    *router.urls,
    *project_router.urls,
]
