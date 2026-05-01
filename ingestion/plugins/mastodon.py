"""Mastodon source plugin used to ingest public timelines and lists."""

from __future__ import annotations

import html
import logging
import time
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.html import strip_tags
from mastodon import Mastodon

from ingestion.plugins.base import ContentItem, SourcePlugin
from projects.model_support import (
    DEFAULT_MASTODON_INSTANCE_URL,
    SourcePluginName,
    normalize_mastodon_handle,
    normalize_mastodon_instance_url,
)
from projects.models import MastodonCredentials

logger = logging.getLogger(__name__)


class MastodonSourcePlugin(SourcePlugin):
    """Fetch Mastodon hashtags, account timelines, or list timelines."""

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
    def verify_credentials(cls, credentials: MastodonCredentials) -> None:
        """Authenticate a stored Mastodon token and confirm the bound account."""

        try:
            client = cls._authenticated_client_for_credentials(credentials)
            account = client.account_verify_credentials()
        except Exception as exc:
            cls._record_credentials_status(credentials, error_message=str(exc))
            raise
        cls._record_credentials_status(
            credentials,
            error_message="",
            account_acct=cls._account_acct(
                account,
                instance_url=credentials.api_base_url,
            ),
        )

    @classmethod
    def validate_config(cls, config: object) -> dict:
        """Validate Mastodon hashtag, account, or list configuration."""

        normalized_config = super().validate_config(config)
        normalized_config["instance_url"] = normalize_mastodon_instance_url(
            str(normalized_config.get("instance_url", ""))
        )
        hashtag = str(normalized_config.get("hashtag", "")).strip().removeprefix("#")
        account_acct = str(normalized_config.get("account_acct", "")).strip()
        list_id = normalized_config.get("list_id")
        configured_sources = [
            bool(hashtag),
            bool(account_acct),
            list_id not in (None, ""),
        ]
        if sum(configured_sources) != 1:
            raise ValueError("Provide exactly one of hashtag, account_acct, or list_id")

        if hashtag:
            normalized_config["hashtag"] = hashtag.lower()
        if account_acct:
            normalized_account = normalize_mastodon_handle(
                account_acct,
                instance_url=normalized_config["instance_url"],
            )
            if not normalized_account:
                raise ValueError("account_acct must be a non-empty Mastodon account")
            normalized_config["account_acct"] = normalized_account
        if list_id not in (None, ""):
            normalized_config["list_id"] = cls._coerce_positive_int(
                list_id,
                field_name="list_id",
            )

        normalized_config["max_statuses_per_fetch"] = cls._coerce_positive_int(
            normalized_config.get("max_statuses_per_fetch", 100),
            field_name="max_statuses_per_fetch",
        )

        include_replies = normalized_config.get("include_replies", False)
        if not isinstance(include_replies, bool):
            raise ValueError("include_replies must be a boolean")
        normalized_config["include_replies"] = include_replies

        include_reblogs = normalized_config.get("include_reblogs", True)
        if not isinstance(include_reblogs, bool):
            raise ValueError("include_reblogs must be a boolean")
        normalized_config["include_reblogs"] = include_reblogs
        return normalized_config

    def fetch_new_content(self, since: datetime | None) -> list[ContentItem]:
        """Fetch Mastodon statuses newer than ``since`` and normalize them."""

        statuses = self._get_statuses()
        items: list[ContentItem] = []
        seen_status_uris: set[str] = set()
        for status in statuses:
            status_uri = str(self._nested_value(status, "uri") or "")
            if status_uri and status_uri in seen_status_uris:
                continue
            if status_uri:
                seen_status_uris.add(status_uri)
            published_date = self._published_date_for_status(status)
            if since and published_date <= since:
                continue
            items.append(self._build_content_item(status, published_date))
        return items

    def health_check(self) -> bool:
        """Treat the source as healthy when the configured timeline is reachable."""

        credentials = self._credentials()
        try:
            if credentials is not None:
                self.verify_credentials(credentials)
            else:
                logger.warning(
                    "Mastodon health check is using anonymous access for project id=%s instance=%s",
                    self.project.id,
                    self._instance_url(),
                )
            self._get_statuses(limit=1)
        except Exception as exc:
            self._record_credentials_status(credentials, error_message=str(exc))
            raise
        self._record_credentials_status(credentials, error_message="")
        return True

    def match_entity_for_item(self, item: ContentItem):
        """Match statuses to entities using the author's Mastodon acct first."""

        author_acct = normalize_mastodon_handle(
            str((item.source_metadata or {}).get("author_acct", "")),
            instance_url=self._instance_url(),
        )
        if author_acct:
            for entity in self.project.entities.exclude(mastodon_handle=""):
                if (
                    normalize_mastodon_handle(
                        entity.mastodon_handle,
                        instance_url=self._instance_url(),
                    )
                    == author_acct
                ):
                    return entity
        return super().match_entity_for_item(item)

    def _get_statuses(self, limit: int | None = None):
        """Query the configured hashtag, account timeline, or list timeline."""

        request_limit = limit or self.source_config.config.get(
            "max_statuses_per_fetch", 100
        )
        client = self._client()
        config = self.source_config.config
        if config.get("hashtag"):
            statuses = client.timeline_hashtag(
                config["hashtag"],
                limit=request_limit,
            )
        elif config.get("account_acct"):
            account = client.account_lookup(config["account_acct"])
            account_id = self._nested_value(account, "id")
            if isinstance(account_id, bool) or not isinstance(account_id, (str, int)):
                raise RuntimeError(
                    "Mastodon account lookup did not return a usable account ID."
                )
            statuses = client.account_statuses(
                account_id,
                limit=request_limit,
                exclude_replies=not config.get("include_replies", False),
                exclude_reblogs=not config.get("include_reblogs", True),
            )
        else:
            statuses = client.timeline_list(
                config["list_id"],
                limit=request_limit,
            )
        self._apply_rate_limit_delay(client)
        return statuses

    def _build_content_item(self, status: Any, published_date: datetime) -> ContentItem:
        """Convert one Mastodon status into the shared plugin payload."""

        author_acct = self._account_acct(
            self._nested_value(status, "account"),
            instance_url=self._status_instance_url(status),
        )
        author_display_name = self._display_name(self._nested_value(status, "account"))
        card_url = str(self._nested_value(status, "card", "url") or "").strip()
        card_title = str(self._nested_value(status, "card", "title") or "").strip()
        status_url = str(self._nested_value(status, "url") or "").strip()
        status_uri = str(self._nested_value(status, "uri") or "").strip()
        content_text = self._content_text(status)
        title = (
            card_title
            or content_text.splitlines()[0].strip()
            or status_url
            or status_uri
        )
        return ContentItem(
            url=card_url or status_url or status_uri,
            title=title,
            author=author_display_name or author_acct,
            published_date=published_date,
            content_text=content_text or card_title or status_url or status_uri,
            source_plugin=SourcePluginName.MASTODON,
            source_metadata={
                "author_acct": author_acct,
                "author_display_name": author_display_name,
                "embedded_url": card_url,
                "instance_url": self._status_instance_url(status),
                "favorite_count": self._nested_value(status, "favourites_count") or 0,
                "reblog_count": self._nested_value(status, "reblogs_count") or 0,
                "reply_count": self._nested_value(status, "replies_count") or 0,
                "status_uri": status_uri,
                "status_url": status_url,
            },
        )

    def _client(self):
        """Create an anonymous or authenticated Mastodon client."""

        credentials = self._credentials()
        if credentials is None:
            return Mastodon(api_base_url=self._instance_url())
        return self._authenticated_client_for_credentials(credentials)

    def _credentials(self) -> MastodonCredentials | None:
        """Return the active Mastodon credentials matching this source instance."""

        credentials = MastodonCredentials.objects.filter(
            project=self.project,
            is_active=True,
        ).first()
        if credentials is None:
            return None
        if credentials.api_base_url != self._instance_url():
            return None
        return credentials

    def _instance_url(self) -> str:
        """Return the normalized source instance URL."""

        return normalize_mastodon_instance_url(
            str(self.source_config.config.get("instance_url", ""))
        )

    @staticmethod
    def _authenticated_client_for_credentials(credentials: MastodonCredentials):
        """Build an authenticated client from a stored credential record."""

        if not credentials.has_access_token():
            raise RuntimeError("Mastodon credentials are missing an access token.")
        return Mastodon(
            access_token=credentials.get_access_token(),
            api_base_url=credentials.api_base_url,
        )

    @staticmethod
    def _record_credentials_status(
        credentials: MastodonCredentials | None,
        *,
        error_message: str,
        account_acct: str = "",
    ) -> None:
        """Persist the latest credential verification result when credentials exist."""

        if credentials is None:
            return
        update_fields = ["last_error", "updated_at"]
        credentials.last_error = error_message
        if account_acct:
            credentials.account_acct = account_acct
            update_fields.append("account_acct")
        if not error_message:
            credentials.last_verified_at = timezone.now()
            update_fields.append("last_verified_at")
        credentials.save(update_fields=update_fields)

    @staticmethod
    def _published_date_for_status(status: Any) -> datetime:
        """Choose the published timestamp for a Mastodon status."""

        value = MastodonSourcePlugin._nested_value(status, "created_at")
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            parsed_value = parse_datetime(value)
            if parsed_value is not None:
                return parsed_value
        return timezone.now()

    @staticmethod
    def _content_text(status: Any) -> str:
        """Extract readable plain text from the HTML status body."""

        content_html = str(MastodonSourcePlugin._nested_value(status, "content") or "")
        return html.unescape(strip_tags(content_html)).strip()

    @staticmethod
    def _display_name(account: Any) -> str:
        """Return the stripped display name for an account payload."""

        return str(
            MastodonSourcePlugin._nested_value(account, "display_name") or ""
        ).strip()

    @staticmethod
    def _account_acct(account: Any, *, instance_url: str) -> str:
        """Normalize an account payload into canonical ``user@host`` form."""

        account_url = str(MastodonSourcePlugin._nested_value(account, "url") or "")
        account_instance = normalize_mastodon_instance_url(account_url or instance_url)
        raw_acct = str(MastodonSourcePlugin._nested_value(account, "acct") or "")
        username = str(MastodonSourcePlugin._nested_value(account, "username") or "")
        normalized_acct = normalize_mastodon_handle(
            raw_acct, instance_url=account_instance
        )
        if normalized_acct:
            return normalized_acct
        return normalize_mastodon_handle(username, instance_url=account_instance)

    @staticmethod
    def _status_instance_url(status: Any) -> str:
        """Infer the instance URL from the status or account URL."""

        for value in (
            MastodonSourcePlugin._nested_value(status, "url"),
            MastodonSourcePlugin._nested_value(status, "account", "url"),
            MastodonSourcePlugin._nested_value(status, "uri"),
        ):
            if value:
                parsed_value = urlsplit(str(value))
                if parsed_value.scheme and parsed_value.netloc:
                    return f"{parsed_value.scheme}://{parsed_value.netloc}"
        return DEFAULT_MASTODON_INSTANCE_URL

    @staticmethod
    def _apply_rate_limit_delay(client: Any) -> None:
        """Honor rate-limit reset hints when the client exposes them."""

        remaining = getattr(client, "ratelimit_remaining", None)
        reset_at = getattr(client, "ratelimit_reset", None)
        if remaining is None or reset_at is None:
            return
        if remaining > 1:
            return
        if not isinstance(reset_at, datetime):
            return
        delay_seconds = (reset_at - timezone.now()).total_seconds()
        if delay_seconds > 0:
            time.sleep(min(delay_seconds, 1))

    @staticmethod
    def _nested_value(value: Any, *path: str):
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
