from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse


@dataclass(slots=True)
class ContentItem:
    url: str
    title: str
    author: str
    published_date: datetime
    content_text: str
    source_plugin: str


class SourcePlugin(ABC):
    required_config_fields: tuple[str, ...] = ()

    def __init__(self, source_config):
        self.source_config = source_config
        self.project = source_config.project

    @classmethod
    def validate_config(cls, config: object) -> dict:
        if not isinstance(config, dict):
            raise ValueError("Config must be a JSON object.")
        normalized_config = dict(config)
        for field_name in cls.required_config_fields:
            if not normalized_config.get(field_name):
                raise ValueError(f"Missing required config field: {field_name}")
        return normalized_config

    @abstractmethod
    def fetch_new_content(self, since: datetime | None) -> list[ContentItem]:
        raise NotImplementedError

    @abstractmethod
    def health_check(self) -> bool:
        raise NotImplementedError

    def match_entity_for_url(self, url: str):
        target_hostname = self._normalize_hostname(url)
        if not target_hostname:
            return None
        for entity in self.project.entities.exclude(website_url=""):
            if self._normalize_hostname(entity.website_url) == target_hostname:
                return entity
        return None

    @staticmethod
    def _normalize_hostname(url: str) -> str:
        hostname = urlparse(url).hostname or ""
        return hostname.removeprefix("www.").lower()
