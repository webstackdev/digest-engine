"""Project-scoped LinkedIn OAuth helpers and callback handling."""

from __future__ import annotations

from datetime import timedelta
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import requests
from django.conf import settings
from django.core import signing
from django.http import HttpRequest, HttpResponseRedirect
from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET

from ingestion.plugins.linkedin import LINKEDIN_TOKEN_URL, LinkedInSourcePlugin
from projects.models import LinkedInCredentials, Project

LINKEDIN_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_OAUTH_STATE_SALT = "projects.linkedin-oauth"
LINKEDIN_OAUTH_STATE_MAX_AGE_SECONDS = 900


def _oauth_scopes() -> list[str]:
    """Return the configured LinkedIn OAuth scopes in request order."""

    raw_scopes = getattr(
        settings,
        "LINKEDIN_OAUTH_SCOPES",
        "openid profile email offline_access",
    )
    if isinstance(raw_scopes, str):
        scopes = [scope for scope in raw_scopes.split() if scope]
    else:
        scopes = [str(scope).strip() for scope in raw_scopes if str(scope).strip()]
    return scopes or ["openid", "profile", "email", "offline_access"]


def _callback_url() -> str:
    """Build the absolute LinkedIn OAuth callback URL for this deployment."""

    return (
        f"{settings.NEWSLETTER_API_BASE_URL.rstrip('/')}"
        f"{reverse('v1:linkedin-oauth-callback')}"
    )


def normalize_linkedin_redirect_path(redirect_to: str | None, project_id: int) -> str:
    """Return a safe frontend-relative redirect path for LinkedIn OAuth results."""

    default_path = f"/admin/sources?project={project_id}"
    if not redirect_to:
        return default_path

    normalized_redirect = str(redirect_to).strip()
    if not normalized_redirect.startswith("/") or normalized_redirect.startswith("//"):
        return default_path
    return normalized_redirect


def build_linkedin_oauth_state(project: Project, redirect_to: str | None) -> str:
    """Serialize the project-scoped OAuth callback state into a signed token."""

    return signing.dumps(
        {
            "project_id": project.pk,
            "redirect_to": normalize_linkedin_redirect_path(redirect_to, project.pk),
        },
        salt=LINKEDIN_OAUTH_STATE_SALT,
    )


def load_linkedin_oauth_state(state: str) -> dict[str, Any]:
    """Deserialize a signed LinkedIn OAuth callback state payload."""

    return signing.loads(
        state,
        salt=LINKEDIN_OAUTH_STATE_SALT,
        max_age=LINKEDIN_OAUTH_STATE_MAX_AGE_SECONDS,
    )


def build_linkedin_authorize_url(project: Project, redirect_to: str | None) -> str:
    """Build the LinkedIn authorization URL for one project admin flow."""

    if not settings.LINKEDIN_CLIENT_ID or not settings.LINKEDIN_CLIENT_SECRET:
        raise RuntimeError("LinkedIn OAuth client credentials are not configured.")

    query = urlencode(
        {
            "response_type": "code",
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "redirect_uri": _callback_url(),
            "scope": " ".join(_oauth_scopes()),
            "state": build_linkedin_oauth_state(project, redirect_to),
        }
    )
    return f"{LINKEDIN_AUTHORIZE_URL}?{query}"


def _build_frontend_redirect_url(redirect_to: str, params: dict[str, str]) -> str:
    """Append status query params to a safe frontend-relative redirect path."""

    absolute_url = urljoin(settings.FRONTEND_BASE_URL.rstrip("/") + "/", redirect_to)
    split_url = urlsplit(absolute_url)
    query = dict(parse_qsl(split_url.query, keep_blank_values=True))
    query.update(params)
    return urlunsplit(
        (
            split_url.scheme,
            split_url.netloc,
            split_url.path,
            urlencode(query),
            split_url.fragment,
        )
    )


def exchange_linkedin_code(code: str) -> dict[str, Any]:
    """Exchange a LinkedIn OAuth authorization code for project tokens."""

    if not settings.LINKEDIN_CLIENT_ID or not settings.LINKEDIN_CLIENT_SECRET:
        raise RuntimeError("LinkedIn OAuth client credentials are not configured.")

    response = requests.post(
        LINKEDIN_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": _callback_url(),
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "client_secret": settings.LINKEDIN_CLIENT_SECRET,
        },
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()

    access_token = str(payload.get("access_token") or "").strip()
    refresh_token = str(payload.get("refresh_token") or "").strip()
    expires_in = int(payload.get("expires_in") or 0)

    if not access_token:
        raise RuntimeError(
            "LinkedIn token exchange response did not include an access token."
        )
    if not refresh_token:
        raise RuntimeError(
            "LinkedIn token exchange response did not include a refresh token. "
            "Ensure the LinkedIn app grants offline access."
        )
    if expires_in <= 0:
        raise RuntimeError(
            "LinkedIn token exchange response did not include a usable expiry."
        )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": timezone.now() + timedelta(seconds=expires_in),
    }


def persist_linkedin_oauth_credentials(
    project: Project,
    token_payload: dict[str, Any],
) -> LinkedInCredentials:
    """Store exchanged LinkedIn OAuth credentials for the selected project."""

    credentials, _created = LinkedInCredentials.objects.get_or_create(project=project)
    credentials.set_access_token(str(token_payload["access_token"]))
    credentials.set_refresh_token(str(token_payload["refresh_token"]))
    credentials.expires_at = token_payload["expires_at"]
    credentials.is_active = True
    credentials.last_error = ""
    credentials.save(
        update_fields=[
            "access_token_encrypted",
            "refresh_token_encrypted",
            "expires_at",
            "is_active",
            "last_error",
            "updated_at",
        ]
    )

    try:
        LinkedInSourcePlugin.verify_credentials(credentials)
    except Exception as exc:
        raise RuntimeError(
            "LinkedIn authorized successfully, but the stored credentials could not be verified."
        ) from exc

    credentials.refresh_from_db()
    return credentials


@require_GET
def linkedin_oauth_callback_view(request: HttpRequest) -> HttpResponseRedirect:
    """Handle the LinkedIn OAuth callback and redirect back to the sources UI."""

    redirect_to = "/admin/sources"

    try:
        state_payload = load_linkedin_oauth_state(str(request.GET.get("state") or ""))
        project_id = int(state_payload["project_id"])
        redirect_to = normalize_linkedin_redirect_path(
            state_payload.get("redirect_to"),
            project_id,
        )
        project = Project.objects.get(pk=project_id)

        oauth_error = str(request.GET.get("error") or "").strip()
        if oauth_error:
            error_detail = str(request.GET.get("error_description") or oauth_error).strip()
            return redirect(
                _build_frontend_redirect_url(
                    redirect_to,
                    {"error": f"LinkedIn authorization failed: {error_detail}"},
                )
            )

        code = str(request.GET.get("code") or "").strip()
        if not code:
            raise RuntimeError("LinkedIn did not return an authorization code.")

        persist_linkedin_oauth_credentials(project, exchange_linkedin_code(code))
        return redirect(
            _build_frontend_redirect_url(
                redirect_to,
                {"message": "LinkedIn credentials authorized."},
            )
        )
    except Exception as exc:
        return redirect(
            _build_frontend_redirect_url(
                redirect_to,
                {"error": str(exc) or "Unable to authorize LinkedIn credentials."},
            )
        )