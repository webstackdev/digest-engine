"""Support types and helpers for project-owned models."""

import base64
import hashlib
import secrets
from urllib.parse import urlsplit, urlunsplit

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models

DEFAULT_MASTODON_INSTANCE_URL = "https://mastodon.social"


def generate_project_intake_token() -> str:
    """Generate the stable token used in project-specific intake email aliases."""

    return secrets.token_hex(16)


def normalize_bluesky_handle(handle: str) -> str:
    """Normalize Bluesky handles so stored account references stay consistent."""

    return handle.strip().removeprefix("@").lower()


def normalize_bluesky_pds_url(pds_url: str) -> str:
    """Normalize a user-provided PDS URL to its base host form."""

    stripped_url = pds_url.strip().rstrip("/")
    if not stripped_url:
        return ""
    parsed_url = urlsplit(stripped_url)
    path = parsed_url.path.rstrip("/")
    if path.endswith("/xrpc"):
        path = path[: -len("/xrpc")]
    return urlunsplit(
        (
            parsed_url.scheme,
            parsed_url.netloc,
            path,
            parsed_url.query,
            parsed_url.fragment,
        )
    ).rstrip("/")


def normalize_mastodon_instance_url(instance_url: str) -> str:
    """Normalize a Mastodon instance URL to its base origin."""

    stripped_url = instance_url.strip().rstrip("/")
    if not stripped_url:
        return DEFAULT_MASTODON_INSTANCE_URL
    parsed_url = urlsplit(stripped_url)
    return urlunsplit(
        (
            parsed_url.scheme,
            parsed_url.netloc,
            "",
            "",
            "",
        )
    ).rstrip("/")


def normalize_mastodon_handle(handle: str, *, instance_url: str = "") -> str:
    """Normalize a Mastodon account reference to ``user@host`` form."""

    normalized_handle = handle.strip().removeprefix("@").lower()
    if not normalized_handle:
        return ""
    if "@" in normalized_handle:
        return normalized_handle
    instance_host = (
        urlsplit(normalize_mastodon_instance_url(instance_url)).hostname or ""
    )
    if instance_host:
        return f"{normalized_handle}@{instance_host.lower()}"
    return normalized_handle


def bluesky_credentials_fernet() -> Fernet:
    """Build the symmetric cipher used for Bluesky app-password storage."""

    key_material = (
        getattr(settings, "BLUESKY_CREDENTIALS_ENCRYPTION_KEY", "")
        or settings.SECRET_KEY
    )
    derived_key = base64.urlsafe_b64encode(
        hashlib.sha256(key_material.encode("utf-8")).digest()
    )
    return Fernet(derived_key)


def mastodon_credentials_fernet() -> Fernet:
    """Build the symmetric cipher used for Mastodon access-token storage."""

    key_material = (
        getattr(settings, "MASTODON_CREDENTIALS_ENCRYPTION_KEY", "")
        or settings.SECRET_KEY
    )
    derived_key = base64.urlsafe_b64encode(
        hashlib.sha256(key_material.encode("utf-8")).digest()
    )
    return Fernet(derived_key)


class SourcePluginName(models.TextChoices):
    """Built-in ingestion plugins that can populate project content."""

    RSS = "rss", "RSS"
    REDDIT = "reddit", "Reddit"
    BLUESKY = "bluesky", "Bluesky"
    MASTODON = "mastodon", "Mastodon"
