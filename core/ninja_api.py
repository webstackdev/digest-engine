"""Shared Django Ninja auth helpers that avoid DRF runtime coupling."""

from __future__ import annotations

import base64
import binascii

from django.contrib.auth import authenticate
from django.http import HttpRequest

from core.jwt import authenticate_access_token


def _session_user(request: HttpRequest) -> object | None:
    """Return the authenticated Django session user, if present."""

    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        request.auth = getattr(request, "auth", None)
        return user
    return None


def _authorization_header(request: HttpRequest) -> str:
    """Return the raw Authorization header value for one request."""

    return request.META.get("HTTP_AUTHORIZATION", "").strip()


def _bearer_user(request: HttpRequest) -> object | None:
    """Authenticate one request from a Bearer JWT authorization header."""

    header = _authorization_header(request)
    if not header:
        return None

    scheme, _, raw_token = header.partition(" ")
    if scheme.lower() != "bearer" or not raw_token:
        return None

    user, payload = authenticate_access_token(raw_token)
    if user is None or payload is None:
        return None

    request.user = user
    request.auth = payload
    return user


def _basic_user(request: HttpRequest) -> object | None:
    """Authenticate one request from an HTTP Basic authorization header."""

    header = _authorization_header(request)
    if not header:
        return None

    scheme, _, value = header.partition(" ")
    if scheme.lower() != "basic" or not value:
        return None

    try:
        decoded = base64.b64decode(value).decode("utf-8")
    except (ValueError, binascii.Error, UnicodeDecodeError):
        return None

    username, separator, password = decoded.partition(":")
    if not separator:
        return None

    user = authenticate(request, username=username, password=password)
    if user is None:
        return None

    request.user = user
    request.auth = None
    return user


def api_authenticate(request: HttpRequest) -> object | None:
    """Authenticate one Ninja request with session, bearer, or basic auth."""

    for resolver in (_session_user, _bearer_user, _basic_user):
        user = resolver(request)
        if user is None:
            continue
        return user
    return None


__all__ = ["api_authenticate"]
