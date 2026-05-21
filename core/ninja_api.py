"""Shared Django Ninja auth helpers that avoid DRF runtime coupling."""

from __future__ import annotations

import base64
import binascii

from django.contrib.auth import authenticate
from django.http import HttpRequest
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import (
    AuthenticationFailed as SimpleJWTAuthenticationFailed,
    InvalidToken,
    TokenError,
)


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

    authenticator = JWTAuthentication()
    header = authenticator.get_header(request)
    if header is None:
        return None

    try:
        raw_token = authenticator.get_raw_token(header)
    except SimpleJWTAuthenticationFailed:
        return None
    if raw_token is None:
        return None

    try:
        validated_token = authenticator.get_validated_token(raw_token)
        user = authenticator.get_user(validated_token)
    except (InvalidToken, TokenError, SimpleJWTAuthenticationFailed):
        return None

    request.user = user
    request.auth = validated_token
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


def drf_authenticate(request: HttpRequest) -> object | None:
    """Authenticate one Ninja request with session, bearer, or basic auth."""

    for resolver in (_session_user, _bearer_user, _basic_user):
        user = resolver(request)
        if user is None:
            continue
        return user
    return None


__all__ = ["drf_authenticate"]
