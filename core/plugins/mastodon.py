"""Compatibility wrapper for the Mastodon source plugin."""

from mastodon import Mastodon

from ingestion.plugins.mastodon import MastodonSourcePlugin

__all__ = ["Mastodon", "MastodonSourcePlugin"]
