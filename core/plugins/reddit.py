from __future__ import annotations

from datetime import UTC, datetime

import praw
from django.conf import settings

from core.models import SourcePluginName
from core.plugins.base import ContentItem, SourcePlugin


class RedditSourcePlugin(SourcePlugin):
    required_config_fields = ("subreddit",)

    @classmethod
    def validate_config(cls, config: object) -> dict:
        normalized_config = super().validate_config(config)
        listing = normalized_config.get("listing", "both")
        if listing not in {"new", "hot", "both"}:
            raise ValueError("listing must be one of: new, hot, both")
        normalized_config["listing"] = listing
        normalized_config["limit"] = int(normalized_config.get("limit", 25))
        if normalized_config["limit"] <= 0:
            raise ValueError("limit must be a positive integer")
        return normalized_config

    def fetch_new_content(self, since: datetime | None) -> list[ContentItem]:
        subreddit = self._client().subreddit(self.source_config.config["subreddit"])
        items: list[ContentItem] = []
        seen_submission_ids: set[str] = set()
        for submission in self._iter_submissions(subreddit):
            if submission.id in seen_submission_ids:
                continue
            seen_submission_ids.add(submission.id)
            published_date = datetime.fromtimestamp(submission.created_utc, tz=UTC)
            if since and published_date <= since:
                continue
            items.append(
                ContentItem(
                    url=submission.url or f"https://www.reddit.com{submission.permalink}",
                    title=submission.title.strip(),
                    author=str(submission.author) if submission.author else "",
                    published_date=published_date,
                    content_text=(submission.selftext or submission.title).strip(),
                    source_plugin=SourcePluginName.REDDIT,
                )
            )
        return items

    def health_check(self) -> bool:
        subreddit = self._client().subreddit(self.source_config.config["subreddit"])
        next(subreddit.new(limit=1), None)
        return True

    def match_entity_for_url(self, url: str):
        return None

    def _iter_submissions(self, subreddit):
        listing = self.source_config.config.get("listing", "both")
        limit = self.source_config.config.get("limit", 25)
        if listing in {"new", "both"}:
            yield from subreddit.new(limit=limit)
        if listing in {"hot", "both"}:
            yield from subreddit.hot(limit=limit)

    @staticmethod
    def _client():
        if not settings.REDDIT_CLIENT_ID or not settings.REDDIT_CLIENT_SECRET:
            raise RuntimeError("Reddit credentials are not configured.")
        return praw.Reddit(
            client_id=settings.REDDIT_CLIENT_ID,
            client_secret=settings.REDDIT_CLIENT_SECRET,
            user_agent=settings.REDDIT_USER_AGENT,
        )