"""LinkedIn source plugin used to ingest organization, member, and newsletter posts."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import requests
from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from ingestion.plugins.base import ContentItem, SourcePlugin
from projects.model_support import (
    SourcePluginName,
    normalize_linkedin_url,
    normalize_linkedin_urn,
)
from projects.models import LinkedInCredentials

LINKEDIN_API_BASE_URL = "https://api.linkedin.com/v2"
LINKEDIN_POSTS_URL = "https://api.linkedin.com/rest/posts"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"

LinkedInRequestParamValue = str | int | float | bytes | None


class LinkedInSourcePlugin(SourcePlugin):
    """Fetch LinkedIn organization, member, and newsletter posts."""

    @staticmethod
    def _coerce_positive_int(value: object, *, field_name: str) -> int:
        """Coerce a user-provided positive integer config value."""

        if isinstance(value, bool):
            raise ValueError(f"{field_name} must be a positive integer")
        if isinstance(value, int):
            coerced_value = value
        elif isinstance(value, str):
            coerced_value = int(value)
        else:
            raise ValueError(f"{field_name} must be a positive integer")
        if coerced_value <= 0:
            raise ValueError(f"{field_name} must be a positive integer")
        return coerced_value

    @classmethod
    def validate_config(cls, config: object) -> dict:
        """Validate LinkedIn organization, member, or newsletter configuration."""

        normalized_config = super().validate_config(config)
        normalized_targets: dict[str, str] = {}
        for field_name in ("organization_urn", "person_urn", "newsletter_urn"):
            raw_value = str(normalized_config.get(field_name, "")).strip()
            if not raw_value:
                continue
            normalized_targets[field_name] = normalize_linkedin_urn(raw_value)
        if not normalized_targets:
            raise ValueError(
                "Provide at least one of organization_urn, person_urn, or newsletter_urn"
            )
        normalized_config.update(normalized_targets)
        normalized_config["max_posts_per_fetch"] = cls._coerce_positive_int(
            normalized_config.get("max_posts_per_fetch", 50),
            field_name="max_posts_per_fetch",
        )
        include_reshares = normalized_config.get("include_reshares", False)
        if not isinstance(include_reshares, bool):
            raise ValueError("include_reshares must be a boolean")
        normalized_config["include_reshares"] = include_reshares
        return normalized_config

    @classmethod
    def verify_credentials(cls, credentials: LinkedInCredentials) -> None:
        """Call LinkedIn's member identity endpoint with the stored access token."""

        if not credentials.has_access_token():
            raise RuntimeError("LinkedIn credentials are missing an access token.")
        try:
            payload = cls._request_json(
                f"{LINKEDIN_API_BASE_URL}/me",
                access_token=credentials.get_access_token(),
            )
        except Exception as exc:
            cls._record_credentials_status(credentials, error_message=str(exc))
            raise
        member_id = str(payload.get("id") or "").strip()
        member_urn = (
            normalize_linkedin_urn(f"urn:li:person:{member_id}") if member_id else ""
        )
        cls._record_credentials_status(
            credentials,
            error_message="",
            member_urn=member_urn or credentials.member_urn,
        )

    @classmethod
    def refresh_credentials(cls, credentials: LinkedInCredentials) -> None:
        """Refresh the stored LinkedIn access token using the refresh token."""

        if not credentials.has_refresh_token():
            raise RuntimeError("LinkedIn credentials are missing a refresh token.")
        if not settings.LINKEDIN_CLIENT_ID or not settings.LINKEDIN_CLIENT_SECRET:
            raise RuntimeError("LinkedIn OAuth client credentials are not configured.")
        response = requests.post(
            LINKEDIN_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": credentials.get_refresh_token(),
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        access_token = str(payload.get("access_token") or "").strip()
        if not access_token:
            raise RuntimeError(
                "LinkedIn token refresh response did not include an access token."
            )
        expires_in = int(payload.get("expires_in") or 0)
        if expires_in <= 0:
            raise RuntimeError(
                "LinkedIn token refresh response did not include a usable expiry."
            )
        refreshed_token = str(payload.get("refresh_token") or "").strip()
        credentials.set_access_token(access_token)
        update_fields = [
            "access_token_encrypted",
            "expires_at",
            "last_error",
            "updated_at",
        ]
        if refreshed_token:
            credentials.set_refresh_token(refreshed_token)
            update_fields.append("refresh_token_encrypted")
        credentials.expires_at = timezone.now() + timedelta(seconds=expires_in)
        credentials.last_error = ""
        credentials.save(update_fields=update_fields)

    def fetch_new_content(self, since: datetime | None) -> list[ContentItem]:
        """Fetch LinkedIn posts newer than ``since`` and normalize them."""

        posts = self._get_posts()
        items: list[ContentItem] = []
        seen_post_urns: set[str] = set()
        for post in posts:
            post_urn = self._post_urn(post)
            if post_urn in seen_post_urns:
                continue
            seen_post_urns.add(post_urn)
            if not self.source_config.config.get(
                "include_reshares", False
            ) and self._is_reshare(post):
                continue
            published_date = self._published_date_for_post(post)
            if since and published_date <= since:
                continue
            items.append(self._build_content_item(post, published_date))
        return items

    def health_check(self) -> bool:
        """Treat the source as healthy when the configured LinkedIn query succeeds."""

        credentials = self._credentials()
        if credentials is None:
            raise RuntimeError(
                "LinkedIn credentials are not configured for this project."
            )
        if credentials.expires_at and credentials.expires_at <= timezone.now():
            raise RuntimeError(
                "LinkedIn access token has expired and must be refreshed."
            )
        try:
            self._get_posts(limit=1)
        except Exception as exc:
            self._record_credentials_status(credentials, error_message=str(exc))
            raise
        self._record_credentials_status(credentials, error_message="")
        return True

    def match_entity_for_item(self, item: ContentItem):
        """Match posts to entities using the author's LinkedIn URL first."""

        author_profile_url = normalize_linkedin_url(
            str((item.source_metadata or {}).get("author_profile_url", ""))
        )
        if author_profile_url:
            for entity in self.project.entities.exclude(linkedin_url=""):
                if normalize_linkedin_url(entity.linkedin_url) == author_profile_url:
                    return entity
        return super().match_entity_for_item(item)

    def _get_posts(self, limit: int | None = None) -> list[dict[str, Any]]:
        """Query the configured LinkedIn author surfaces and combine the results."""

        credentials = self._credentials()
        if credentials is None:
            raise RuntimeError(
                "LinkedIn credentials are not configured for this project."
            )
        request_limit = limit or self.source_config.config.get(
            "max_posts_per_fetch", 50
        )
        posts: list[dict[str, Any]] = []
        for target_field in ("organization_urn", "person_urn", "newsletter_urn"):
            target_urn = str(self.source_config.config.get(target_field, "")).strip()
            if not target_urn:
                continue
            payload = self._request_json(
                LINKEDIN_POSTS_URL,
                access_token=credentials.get_access_token(),
                params={"author": target_urn, "count": request_limit},
            )
            posts.extend(self._elements_from_response(payload))
        return posts

    def _credentials(self) -> LinkedInCredentials | None:
        """Return the active LinkedIn credentials for the current project."""

        return LinkedInCredentials.objects.filter(
            project=self.project,
            is_active=True,
        ).first()

    def _build_content_item(
        self, post: dict[str, Any], published_date: datetime
    ) -> ContentItem:
        """Convert one LinkedIn post into the shared plugin payload."""

        post_urn = self._post_urn(post)
        embedded_url = self._embedded_article_url(post)
        post_url = str(post.get("permalink") or post_urn)
        body_text = self._body_text(post)
        title = (
            body_text.splitlines()[0].strip()
            if body_text.strip()
            else (embedded_url or post_url)
        )
        content_type = "article" if embedded_url else ""
        author_display_name = str(
            self._nested_value(post, "author", "display_name")
            or post.get("author_display_name")
            or ""
        ).strip()
        author_urn = str(
            self._nested_value(post, "author", "urn")
            or post.get("author")
            or post.get("author_urn")
            or ""
        ).strip()
        author_profile_url = normalize_linkedin_url(
            str(
                self._nested_value(post, "author", "profile_url")
                or post.get("author_profile_url")
                or ""
            )
        )
        return ContentItem(
            url=embedded_url or post_url,
            title=title,
            author=author_display_name or author_urn,
            published_date=published_date,
            content_text=body_text or embedded_url or post_url,
            source_plugin=SourcePluginName.LINKEDIN,
            content_type=content_type,
            source_metadata={
                "author_display_name": author_display_name,
                "author_profile_url": author_profile_url,
                "author_urn": normalize_linkedin_urn(author_urn) if author_urn else "",
                "comment_count": self._engagement_count(
                    post, "comments", "comment_count"
                ),
                "embedded_url": embedded_url,
                "like_count": self._engagement_count(post, "likes", "like_count"),
                "post_urn": post_urn,
                "share_count": self._engagement_count(post, "shares", "share_count"),
            },
        )

    @staticmethod
    def _request_json(
        url: str,
        *,
        access_token: str,
        params: dict[str, LinkedInRequestParamValue] | None = None,
    ) -> dict[str, Any]:
        """Execute one LinkedIn API request and return the JSON payload."""

        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "X-Restli-Protocol-Version": "2.0.0",
            },
            params=params,
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("LinkedIn API responses must be JSON objects.")
        return payload

    @staticmethod
    def _elements_from_response(payload: dict[str, Any]) -> list[dict[str, Any]]:
        """Normalize LinkedIn collection payloads into a flat element list."""

        for key in ("elements", "items", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        return []

    @staticmethod
    def _record_credentials_status(
        credentials: LinkedInCredentials,
        *,
        error_message: str,
        member_urn: str = "",
    ) -> None:
        """Persist the latest LinkedIn verification result."""

        update_fields = ["last_error", "updated_at"]
        credentials.last_error = error_message
        if member_urn:
            credentials.member_urn = member_urn
            update_fields.append("member_urn")
        if not error_message:
            credentials.last_verified_at = timezone.now()
            update_fields.append("last_verified_at")
        credentials.save(update_fields=update_fields)

    @staticmethod
    def _body_text(post: dict[str, Any]) -> str:
        """Extract the most useful plain-text body from a LinkedIn post payload."""

        for value in (
            LinkedInSourcePlugin._nested_value(post, "commentary", "text"),
            LinkedInSourcePlugin._nested_value(post, "text", "text"),
            LinkedInSourcePlugin._nested_value(post, "content", "text"),
            post.get("commentary"),
            post.get("text"),
        ):
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    @staticmethod
    def _embedded_article_url(post: dict[str, Any]) -> str:
        """Return the embedded article URL when one is present."""

        for value in (
            LinkedInSourcePlugin._nested_value(post, "content", "article", "url"),
            LinkedInSourcePlugin._nested_value(post, "content", "media", "url"),
            post.get("embedded_url"),
        ):
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    @staticmethod
    def _post_urn(post: dict[str, Any]) -> str:
        """Return the normalized LinkedIn post URN for a payload."""

        for value in (post.get("id"), post.get("post_urn"), post.get("urn")):
            if isinstance(value, str) and value.strip():
                return normalize_linkedin_urn(value)
        raise RuntimeError("LinkedIn post payloads must include an id or post_urn.")

    @staticmethod
    def _published_date_for_post(post: dict[str, Any]) -> datetime:
        """Choose the published timestamp for a LinkedIn post payload."""

        for value in (
            post.get("published_at"),
            post.get("created_at"),
            LinkedInSourcePlugin._nested_value(post, "publishedAt"),
        ):
            if isinstance(value, datetime):
                return value
            if isinstance(value, str):
                parsed_value = parse_datetime(value)
                if parsed_value is not None:
                    return parsed_value
        return timezone.now()

    @staticmethod
    def _engagement_count(post: dict[str, Any], nested_key: str, flat_key: str) -> int:
        """Read engagement counts from nested or flat LinkedIn payloads."""

        nested_value = LinkedInSourcePlugin._nested_value(
            post, "engagement", nested_key
        )
        value = nested_value if nested_value is not None else post.get(flat_key, 0)
        if isinstance(value, bool):
            return 0
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return 0

    @staticmethod
    def _is_reshare(post: dict[str, Any]) -> bool:
        """Return whether a LinkedIn post payload represents a reshare."""

        for value in (
            post.get("is_reshare"),
            post.get("isReshare"),
            LinkedInSourcePlugin._nested_value(post, "resharedContent"),
        ):
            if isinstance(value, bool):
                return value
            if value is not None:
                return True
        return False

    @staticmethod
    def _nested_value(value: object, *path: str):
        """Read nested object or dict attributes without binding to model types."""

        current_value = value
        for path_part in path:
            if current_value is None:
                return None
            if isinstance(current_value, dict):
                current_value = current_value.get(path_part)
            else:
                current_value = getattr(current_value, path_part, None)
        return current_value
