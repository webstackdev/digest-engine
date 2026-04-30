"""RSS source plugin used to ingest feed entries into project content."""

from __future__ import annotations

from datetime import UTC, datetime
from time import struct_time

import feedparser
from django.utils import timezone

from core.plugins.base import ContentItem, SourcePlugin
from projects.model_support import SourcePluginName


class RSSSourcePlugin(SourcePlugin):
    """Fetch content from a configured RSS or Atom feed."""

    required_config_fields = ("feed_url",)

    def fetch_new_content(self, since: datetime | None) -> list[ContentItem]:
        """Parse the feed and return entries newer than ``since``."""

        parsed_feed = feedparser.parse(self.source_config.config["feed_url"])
        items: list[ContentItem] = []
        for entry in parsed_feed.entries:
            published_date = self._published_date_for_entry(entry)
            if since and published_date <= since:
                continue
            url = getattr(entry, "link", "")
            title = (getattr(entry, "title", "") or "").strip()
            if not url or not title:
                continue
            summary = (
                getattr(entry, "summary", "")
                or getattr(entry, "description", "")
                or title
            )
            items.append(
                ContentItem(
                    url=url,
                    title=title,
                    author=(getattr(entry, "author", "") or "").strip(),
                    published_date=published_date,
                    content_text=summary.strip(),
                    source_plugin=SourcePluginName.RSS,
                )
            )
        return items

    def health_check(self) -> bool:
        """Treat the feed as healthy when it returns at least one entry."""

        parsed_feed = feedparser.parse(self.source_config.config["feed_url"])
        return bool(getattr(parsed_feed, "entries", []))

    @staticmethod
    def _published_date_for_entry(entry) -> datetime:
        """Choose the best available published timestamp for a feed entry."""

        for field_name in ("published_parsed", "updated_parsed", "created_parsed"):
            parsed_value = getattr(entry, field_name, None)
            if parsed_value:
                return RSSSourcePlugin._struct_time_to_datetime(parsed_value)
        return timezone.now()

    @staticmethod
    def _struct_time_to_datetime(parsed_value: struct_time) -> datetime:
        """Convert ``feedparser`` time tuples into timezone-aware datetimes."""

        return datetime(
            parsed_value.tm_year,
            parsed_value.tm_mon,
            parsed_value.tm_mday,
            parsed_value.tm_hour,
            parsed_value.tm_min,
            parsed_value.tm_sec,
            tzinfo=UTC,
        )
