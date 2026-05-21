"""Top-level URL configuration for the digest-engine project."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.shortcuts import redirect
from django.urls import include, path
from django.views.generic.base import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.auth_views import GitHubLoginView, GoogleLoginView
from digest_engine.ninja_api import api as ninja_api
from digest_engine.ninja_api import legacy_api as legacy_ninja_api
from projects.linkedin_oauth import linkedin_oauth_callback_view
from trends.metrics import trend_task_run_metrics_view
from users.auth_views import (
    login_view,
    logout_view,
    password_change_view,
    password_reset_confirm_view,
    password_reset_view,
    register_view,
    user_view,
)


def root_redirect_view(request):
    """Redirect the bare site root to the Django admin."""

    return redirect("/admin/")


legacy_v1_callback_patterns = (
    [
        path(
            "linkedin/oauth/callback/",
            linkedin_oauth_callback_view,
            name="linkedin-oauth-callback",
        )
    ],
    "api",
)


urlpatterns = [
    path("metrics", trend_task_run_metrics_view, name="metrics"),
    path("metrics/", trend_task_run_metrics_view),
    path("", include("core.urls")),
    path("", root_redirect_view),
    path("admin/doc/", include("django.contrib.admindocs.urls")),
    path("admin/", admin.site.urls),
    path("anymail/", include("anymail.urls")),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/auth/login/", login_view, name="auth_login"),
    path("api/auth/logout/", logout_view, name="auth_logout"),
    path(
        "api/auth/password/change/", password_change_view, name="auth_password_change"
    ),
    path("api/auth/password/reset/", password_reset_view, name="auth_password_reset"),
    path(
        "api/auth/password/reset/confirm/",
        password_reset_confirm_view,
        name="auth_password_reset_confirm",
    ),
    path("api/auth/registration/", register_view, name="auth_register"),
    path("api/auth/user/", user_view.as_view(), name="auth_user"),
    path("api/auth/github/", GitHubLoginView.as_view(), name="github_login"),
    path("api/auth/google/", GoogleLoginView.as_view(), name="google_login"),
    path("api/v1/", include(legacy_v1_callback_patterns, namespace="v1")),
    path("api/", ninja_api.urls),
    path("api/ninja/", legacy_ninja_api.urls),
    path(
        "favicon.ico",
        RedirectView.as_view(url="/static/core/favicon.ico", permanent=True),
    ),
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
