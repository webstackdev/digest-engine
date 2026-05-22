"""Authentication views backed by Django auth and JWTs."""

from __future__ import annotations

import json
from urllib.parse import urlencode

from allauth.account.adapter import get_adapter as get_account_adapter
from allauth.account.forms import default_token_generator
from allauth.account.utils import setup_user_email, url_str_to_user_pk, user_pk_to_url_str, user_username
from django.conf import settings
from django.contrib.auth import (
    authenticate,
    update_session_auth_hash,
)
from django.contrib.auth import (
    login as django_login,
)
from django.contrib.auth import (
    logout as django_logout,
)
from django.contrib.auth.forms import SetPasswordForm
from django.contrib.sites.shortcuts import get_current_site
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import HttpRequest, HttpResponseNotAllowed, JsonResponse
from django.utils.decorators import method_decorator
from django.utils.encoding import force_str
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from core.jwt import issue_auth_tokens
from core.ninja_api import api_authenticate
from users.models import AppUser


def _auth_error(message: str, *, status_code: int = 400) -> JsonResponse:
    """Return a normalized auth error payload."""

    return JsonResponse({"detail": message}, status=status_code)


def _auth_response(user: AppUser, *, status_code: int = 200) -> JsonResponse:
    """Return the shared JWT auth payload for one authenticated user."""

    tokens = issue_auth_tokens(user)
    return JsonResponse(
        {
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        },
        status=status_code,
    )


def _parse_json_payload(
    request: HttpRequest,
) -> tuple[dict[str, object] | None, JsonResponse | None]:
    """Decode one JSON request body or return a normalized error response."""

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return None, _auth_error("Request body must be valid JSON.")

    if not isinstance(payload, dict):
        return None, _auth_error("Request body must be a JSON object.")
    return payload, None


def _validation_error_message(error: ValidationError) -> str:
    """Flatten one Django validation error into a stable response string."""

    if hasattr(error, "messages") and error.messages:
        return str(error.messages[0])
    return str(error)


def _validation_error_response(errors: dict[str, object]) -> JsonResponse:
    """Return one field-error payload compatible with the existing auth clients."""

    return JsonResponse(errors, status=400)


def _serialize_auth_user(user: AppUser) -> dict[str, object]:
    """Return the compatibility payload shape for auth user details."""

    return {
        "pk": user.pk,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


def _authenticated_user(request: HttpRequest) -> AppUser | None:
    """Return one authenticated user using the shared API auth bridge."""

    authenticated_user = api_authenticate(request)
    if isinstance(authenticated_user, AppUser):
        return authenticated_user
    return None


def _password_reset_url(*, uid: str, token: str) -> str:
    """Build the frontend password reset URL carried in reset emails."""

    query = urlencode({"uid": uid, "token": token})
    return f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?{query}"


def _send_password_reset_email(request: HttpRequest, *, email: str) -> None:
    """Send password reset emails without revealing whether the email exists."""

    account_adapter = get_account_adapter(request)
    cleaned_email = account_adapter.clean_email(email)
    users = AppUser.objects.filter(email__iexact=cleaned_email, is_active=True)
    current_site = get_current_site(request)

    for user in users:
        token = default_token_generator.make_token(user)
        uid = user_pk_to_url_str(user)
        context = {
            "current_site": current_site,
            "user": user,
            "password_reset_url": _password_reset_url(uid=uid, token=token),
            "request": request,
            "token": token,
            "uid": uid,
        }
        login_methods = getattr(settings, "ACCOUNT_LOGIN_METHODS", set())
        if "email" not in login_methods:
            context["username"] = user_username(user)
        account_adapter.send_mail(
            "account/email/password_reset_key",
            cleaned_email,
            context,
        )


def _reset_password_user(*, uid: str) -> AppUser | None:
    """Resolve one allauth-style password reset uid to a user instance."""

    try:
        user_pk = force_str(url_str_to_user_pk(uid))
        return AppUser.objects.get(pk=user_pk)
    except (TypeError, ValueError, OverflowError, AppUser.DoesNotExist):
        return None


def _authenticate_identifier_password(
    request: HttpRequest,
    *,
    identifier: str,
    password: str,
) -> AppUser | None:
    """Authenticate one user by username first, then by email fallback."""

    authenticated_user = authenticate(request, username=identifier, password=password)
    if isinstance(authenticated_user, AppUser):
        return authenticated_user

    matched_user = AppUser.objects.filter(email__iexact=identifier).first()
    if matched_user is None:
        return None

    authenticated_user = authenticate(
        request,
        username=matched_user.username,
        password=password,
    )
    if isinstance(authenticated_user, AppUser):
        return authenticated_user
    return None


@csrf_exempt
@require_POST
def login_view(request: HttpRequest) -> JsonResponse:
    """Authenticate credentials and return JWT auth data for frontend sessions."""

    payload, error_response = _parse_json_payload(request)
    if error_response is not None:
        return error_response
    assert payload is not None

    identifier = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    if not identifier or not password:
        return _auth_error("Enter both username and password.")

    user = _authenticate_identifier_password(
        request,
        identifier=identifier,
        password=password,
    )
    if user is None:
        return _auth_error("Bad credentials.")

    django_login(request, user)
    return _auth_response(user)


@csrf_exempt
@require_POST
def register_view(request: HttpRequest) -> JsonResponse:
    """Create one user account and return JWT auth data for the new session."""

    payload, error_response = _parse_json_payload(request)
    if error_response is not None:
        return error_response
    assert payload is not None

    username = str(payload.get("username", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password1 = str(payload.get("password1", ""))
    password2 = str(payload.get("password2", ""))
    if not username or not email or not password1 or not password2:
        return _auth_error("Enter a username, email, password1, and password2.")
    if password1 != password2:
        return _auth_error("The two password fields didn't match.")

    account_adapter = get_account_adapter(request)
    try:
        cleaned_email = account_adapter.clean_email(email)
        validate_email(cleaned_email)
        cleaned_username = account_adapter.clean_username(username)
        cleaned_password = account_adapter.clean_password(password1)
    except ValidationError as error:
        return _auth_error(_validation_error_message(error))

    if AppUser.objects.filter(email__iexact=cleaned_email).exists():
        return _auth_error("User is already registered with this e-mail address.")

    user = AppUser.objects.create_user(
        username=cleaned_username,
        email=cleaned_email,
        password=cleaned_password,
    )
    setup_user_email(request, user, [])
    account_adapter.login(request, user)
    return _auth_response(user, status_code=201)


@csrf_exempt
@require_POST
def logout_view(request: HttpRequest) -> JsonResponse:
    """End the current Django session and return the legacy logout payload."""

    django_logout(request)
    return JsonResponse({"detail": "Successfully logged out."})


@csrf_exempt
@require_POST
def password_reset_view(request: HttpRequest) -> JsonResponse:
    """Send a password reset email without exposing account existence."""

    payload, error_response = _parse_json_payload(request)
    if error_response is not None:
        return error_response
    assert payload is not None

    email = str(payload.get("email", "")).strip()
    if not email:
        return _validation_error_response({"email": ["This field is required."]})

    try:
        validate_email(email)
    except ValidationError:
        return _validation_error_response({"email": ["Enter a valid email address."]})

    _send_password_reset_email(request, email=email)
    return JsonResponse({"detail": "Password reset e-mail has been sent."})


@csrf_exempt
@require_POST
def password_reset_confirm_view(request: HttpRequest) -> JsonResponse:
    """Validate one reset token and save a new password."""

    payload, error_response = _parse_json_payload(request)
    if error_response is not None:
        return error_response
    assert payload is not None

    uid = str(payload.get("uid", "")).strip()
    token = str(payload.get("token", "")).strip()
    new_password1 = str(payload.get("new_password1", ""))
    new_password2 = str(payload.get("new_password2", ""))
    if not uid:
        return _validation_error_response({"uid": ["This field is required."]})
    if not token:
        return _validation_error_response({"token": ["This field is required."]})

    user = _reset_password_user(uid=uid)
    if user is None:
        return _validation_error_response({"uid": ["Invalid value"]})
    if not default_token_generator.check_token(user, token):
        return _validation_error_response({"token": ["Invalid value"]})

    form = SetPasswordForm(
        user=user,
        data={"new_password1": new_password1, "new_password2": new_password2},
    )
    if not form.is_valid():
        return JsonResponse(form.errors, status=400)

    form.save()
    return JsonResponse({"detail": "Password has been reset with the new password."})


@csrf_exempt
@require_POST
def password_change_view(request: HttpRequest) -> JsonResponse:
    """Update the authenticated user's password and keep the session active."""

    user = _authenticated_user(request)
    if user is None:
        return _auth_error(
            "Authentication credentials were not provided.",
            status_code=401,
        )

    payload, error_response = _parse_json_payload(request)
    if error_response is not None:
        return error_response
    assert payload is not None

    form = SetPasswordForm(
        user=user,
        data={
            "new_password1": str(payload.get("new_password1", "")),
            "new_password2": str(payload.get("new_password2", "")),
        },
    )
    if not form.is_valid():
        return JsonResponse(form.errors, status=400)

    form.save()
    update_session_auth_hash(request, user)
    return JsonResponse({"detail": "New password has been saved."})


@method_decorator(csrf_exempt, name="dispatch")
class user_view(View):
    """Read or update the authenticated user without framework-specific auth glue."""

    http_method_names = ["get", "patch", "put"]

    def get(self, request: HttpRequest) -> JsonResponse:
        user = _authenticated_user(request)
        if user is None:
            return _auth_error(
                "Authentication credentials were not provided.",
                status_code=401,
            )

        return JsonResponse(_serialize_auth_user(user))

    def patch(self, request: HttpRequest) -> JsonResponse:
        return self._update(request)

    def put(self, request: HttpRequest) -> JsonResponse:
        return self._update(request)

    def _update(self, request: HttpRequest) -> JsonResponse:
        user = _authenticated_user(request)
        if user is None:
            return _auth_error(
                "Authentication credentials were not provided.",
                status_code=401,
            )

        payload, error_response = _parse_json_payload(request)
        if error_response is not None:
            return error_response
        assert payload is not None

        account_adapter = get_account_adapter(request)
        username_value = payload.get("username")
        if isinstance(username_value, str):
            cleaned_username = username_value.strip()
            if cleaned_username and cleaned_username != user.username:
                try:
                    user.username = account_adapter.clean_username(cleaned_username)
                except ValidationError as error:
                    return _auth_error(_validation_error_message(error))

        first_name_value = payload.get("first_name")
        if isinstance(first_name_value, str):
            user.first_name = first_name_value

        last_name_value = payload.get("last_name")
        if isinstance(last_name_value, str):
            user.last_name = last_name_value

        user.save(update_fields=["username", "first_name", "last_name"])
        return JsonResponse(_serialize_auth_user(user))

    def http_method_not_allowed(self, request: HttpRequest, *args, **kwargs):
        return HttpResponseNotAllowed(self._allowed_methods())


__all__ = [
    "login_view",
    "logout_view",
    "password_change_view",
    "password_reset_confirm_view",
    "password_reset_view",
    "register_view",
    "user_view",
]
