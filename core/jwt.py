"""Local JWT helpers for issuing and validating backend auth tokens."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model

ACCESS_TOKEN_LIFETIME = timedelta(minutes=5)
REFRESH_TOKEN_LIFETIME = timedelta(days=1)
JWT_ALGORITHM = "HS256"


def _build_token(*, user_id: int, token_type: str, lifetime: timedelta) -> str:
    """Return one signed JWT for the given user and token type."""

    issued_at = datetime.now(UTC)
    payload = {
        "token_type": token_type,
        "user_id": user_id,
        "iat": issued_at,
        "exp": issued_at + lifetime,
    }
    return str(jwt.encode(payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM))


def issue_auth_tokens(user: Any) -> dict[str, str]:
    """Return the access and refresh tokens for one authenticated user."""

    user_id = int(user.pk)
    return {
        "access": _build_token(
            user_id=user_id,
            token_type="access",
            lifetime=ACCESS_TOKEN_LIFETIME,
        ),
        "refresh": _build_token(
            user_id=user_id,
            token_type="refresh",
            lifetime=REFRESH_TOKEN_LIFETIME,
        ),
    }


def authenticate_access_token(
    raw_token: str,
) -> tuple[object | None, dict[str, Any] | None]:
    """Resolve one bearer access token to a Django user and decoded payload."""

    try:
        payload = jwt.decode(
            raw_token,
            settings.SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.PyJWTError:
        return None, None

    if payload.get("token_type") != "access":
        return None, None

    user_id = payload.get("user_id")
    if not isinstance(user_id, int):
        return None, None

    user_model = get_user_model()
    user = user_model.objects.filter(pk=user_id, is_active=True).first()
    if user is None:
        return None, None

    return user, payload


__all__ = ["authenticate_access_token", "issue_auth_tokens"]
