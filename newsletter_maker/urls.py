"""Top-level URL configuration for the newsletter-maker project."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.shortcuts import redirect
from django.urls import include, path
from django.views.generic.base import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.auth_views import GitHubLoginView, GoogleLoginView
from trends.metrics import trend_task_run_metrics_view


def root_redirect_view(request):
    """Redirect the bare site root to the Django admin."""

    return redirect("/admin/")


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
    path("api/auth/", include("dj_rest_auth.urls")),
    path("api/auth/registration/", include("dj_rest_auth.registration.urls")),
    path("api/auth/github/", GitHubLoginView.as_view(), name="github_login"),
    path("api/auth/google/", GoogleLoginView.as_view(), name="google_login"),
    path("api/v1/", include("users.api_urls")),
    path("api/v1/", include(("core.api_urls", "api"), namespace="v1")),
    path(
        "favicon.ico",
        RedirectView.as_view(url="/static/core/favicon.ico", permanent=True),
    ),
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
