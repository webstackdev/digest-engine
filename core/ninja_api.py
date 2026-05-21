"""Shared Django Ninja helpers for incremental DRF migration."""

from __future__ import annotations

from typing import Any

from django.http import HttpRequest
from ninja import NinjaAPI
from rest_framework.exceptions import APIException
from rest_framework.request import Request
from rest_framework.settings import api_settings


def drf_authenticate(request: HttpRequest) -> object | None:
    """Authenticate one Ninja request with the configured DRF authenticators."""

    drf_request = Request(request)
    for authenticator_class in api_settings.DEFAULT_AUTHENTICATION_CLASSES:
        authenticator = authenticator_class()
        authentication_result = authenticator.authenticate(drf_request)
        if authentication_result is None:
            continue

        user, auth = authentication_result
        request.user = user
        request.auth = auth
        return user

    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return None


def _exception_payload(exc: APIException) -> dict[str, Any] | list[Any]:
    """Normalize one DRF exception into a JSON-serializable payload."""

    detail = exc.detail
    if isinstance(detail, (dict, list)):
        return detail
    return {"detail": str(detail)}


def register_drf_exception_handlers(api: NinjaAPI) -> None:
    """Expose DRF validation and permission errors through Ninja responses."""

    @api.exception_handler(APIException)
    def handle_drf_api_exception(request: HttpRequest, exc: APIException):
        return api.create_response(
            request,
            _exception_payload(exc),
            status=exc.status_code,
        )


__all__ = ["drf_authenticate", "register_drf_exception_handlers"]
