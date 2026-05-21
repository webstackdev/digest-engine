"""Non-DRF social login views for GitHub and Google."""

from __future__ import annotations

import json

from allauth.account import app_settings as allauth_account_settings
from allauth.account.adapter import get_adapter as get_account_adapter
from allauth.socialaccount.helpers import complete_social_login
from allauth.socialaccount.providers.github.views import GitHubOAuth2Adapter
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.http import HttpRequest, HttpResponseBadRequest, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from requests.exceptions import HTTPError
from rest_framework_simplejwt.tokens import RefreshToken

SocialUserModel = get_user_model()


def _social_login_error(message: str, *, status_code: int = 400) -> JsonResponse:
    """Return a normalized social-login error payload."""

    return JsonResponse({"detail": message}, status=status_code)


def _social_login_response(user) -> JsonResponse:
    """Return the frontend auth payload for one authenticated social user."""

    refresh = RefreshToken.for_user(user)
    return JsonResponse(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        }
    )


def _authenticate_social_access_token(
    request: HttpRequest,
    *,
    adapter_class,
    access_token: str,
    id_token: str | None = None,
):
    """Resolve one provider access token into an authenticated Django user."""

    adapter = adapter_class(request)
    app = adapter.get_provider().app
    tokens_to_parse = {"access_token": access_token}
    if id_token:
        tokens_to_parse["id_token"] = id_token

    social_token = adapter.parse_token(tokens_to_parse)
    social_token.app = app

    response = {"id_token": id_token} if id_token else access_token
    social_login = adapter.complete_login(request, app, social_token, response=response)
    social_login.token = social_token

    result = complete_social_login(request, social_login)
    if isinstance(result, HttpResponseBadRequest):
        raise ValueError(result.content.decode("utf-8") or "Authentication failed.")

    if not social_login.is_existing:
        email = getattr(social_login.user, "email", "")
        if (
            allauth_account_settings.UNIQUE_EMAIL
            and email
            and SocialUserModel.objects.filter(email=email).exists()
        ):
            raise ValueError("User is already registered with this e-mail address.")

        social_login.lookup()
        try:
            social_login.save(request, connect=True)
        except IntegrityError as exc:
            raise ValueError(
                "User is already registered with this e-mail address."
            ) from exc

    return social_login.account.user


@method_decorator(csrf_exempt, name="dispatch")
class BaseSocialLoginView(View):
    """Authenticate a provider access token and return JWT auth data."""

    adapter_class = None

    def post(self, request: HttpRequest):
        if self.adapter_class is None:
            return _social_login_error(
                "Social login is not configured.", status_code=500
            )

        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return _social_login_error("Request body must be valid JSON.")

        access_token = str(payload.get("access_token", "")).strip()
        id_token = payload.get("id_token")
        if not access_token:
            return _social_login_error("access_token is required.")

        try:
            user = _authenticate_social_access_token(
                request,
                adapter_class=self.adapter_class,
                access_token=access_token,
                id_token=str(id_token) if isinstance(id_token, str) else None,
            )
        except (HTTPError, ValueError):
            return _social_login_error("Provider rejected token.")

        get_account_adapter(request).login(request, user)
        return _social_login_response(user)


class GitHubLoginView(BaseSocialLoginView):
    adapter_class = GitHubOAuth2Adapter


class GoogleLoginView(BaseSocialLoginView):
    adapter_class = GoogleOAuth2Adapter


__all__ = [
    "GitHubLoginView",
    "GoogleLoginView",
    "_authenticate_social_access_token",
]
