"""Newsletter extraction helpers with OpenRouter fallback to heuristics."""

from __future__ import annotations

import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any

from django.conf import settings

from core.llm import build_skill_user_prompt, get_skill_definition, openrouter_chat_json

URL_PATTERN = re.compile(r"https?://[^\s<>'\"]+")
NEWSLETTER_EXTRACTION_SKILL_NAME = "newsletter_extraction"


@dataclass(slots=True)
class ExtractedNewsletterItem:
    """Represents one link candidate extracted from a newsletter email."""

    url: str
    title: str
    excerpt: str
    position: int


@dataclass(slots=True)
class NewsletterExtractionResult:
    """Structured extraction output plus operational metadata."""

    items: list[ExtractedNewsletterItem]
    metadata: dict[str, Any]


class _NewsletterLinkParser(HTMLParser):
    """Collect anchor tags with HTTP(S) targets from newsletter HTML."""

    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []
        self._active_href: str | None = None
        self._active_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        for name, value in attrs:
            if name == "href" and value and value.startswith(("http://", "https://")):
                self._active_href = value
                self._active_text = []
                return

    def handle_data(self, data: str) -> None:
        if self._active_href is not None:
            self._active_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or self._active_href is None:
            return
        self.links.append(
            {
                "url": self._active_href,
                "title": " ".join(
                    part.strip() for part in self._active_text if part.strip()
                ),
            }
        )
        self._active_href = None
        self._active_text = []


def extract_newsletter_items(
    *, subject: str, raw_html: str, raw_text: str
) -> list[ExtractedNewsletterItem]:
    """Return extracted newsletter items while preserving older call sites."""

    return extract_newsletter_payload(
        subject=subject,
        raw_html=raw_html,
        raw_text=raw_text,
    ).items


def extract_newsletter_payload(
    *, subject: str, raw_html: str, raw_text: str
) -> NewsletterExtractionResult:
    """Extract ordered newsletter items from HTML anchors and plain-text URLs.

    Args:
        subject: Subject line used as a fallback title.
        raw_html: HTML body of the newsletter email.
        raw_text: Plain-text body of the newsletter email.

    Returns:
        The extracted article candidates plus extraction metadata.
    """

    heuristic_items = _extract_newsletter_items_heuristically(
        subject=subject,
        raw_html=raw_html,
        raw_text=raw_text,
    )
    fallback_metadata = {
        "method": "heuristic",
        "model_used": "heuristic",
        "latency_ms": 0,
        "degraded": False,
        "items_extracted": len(heuristic_items),
    }

    if not settings.OPENROUTER_API_KEY:
        return NewsletterExtractionResult(
            items=heuristic_items, metadata=fallback_metadata
        )

    try:
        response = openrouter_chat_json(
            model=settings.AI_SUMMARIZATION_MODEL,
            system_prompt=get_skill_definition(
                NEWSLETTER_EXTRACTION_SKILL_NAME
            ).instructions_markdown,
            user_prompt=build_skill_user_prompt(
                NEWSLETTER_EXTRACTION_SKILL_NAME,
                {
                    "subject": subject,
                    "raw_html": raw_html[:12000],
                    "raw_text": raw_text[:12000],
                },
            ),
        )
        normalized_items = _normalize_llm_items(
            response.payload.get("items", []),
            subject=subject,
            raw_text=raw_text,
        )
        if not normalized_items:
            return NewsletterExtractionResult(
                items=heuristic_items,
                metadata={
                    **fallback_metadata,
                    "degraded": True,
                    "fallback_reason": "OpenRouter returned no valid newsletter items.",
                },
            )
        return NewsletterExtractionResult(
            items=normalized_items,
            metadata={
                "method": "openrouter",
                "model_used": response.model,
                "latency_ms": response.latency_ms,
                "degraded": False,
                "items_extracted": len(normalized_items),
            },
        )
    except Exception as exc:
        return NewsletterExtractionResult(
            items=heuristic_items,
            metadata={
                **fallback_metadata,
                "degraded": True,
                "fallback_reason": str(exc),
            },
        )


def _extract_newsletter_items_heuristically(
    *, subject: str, raw_html: str, raw_text: str
) -> list[ExtractedNewsletterItem]:
    """Extract newsletter items from anchors and text without model calls."""

    parser = _NewsletterLinkParser()
    if raw_html:
        parser.feed(raw_html)

    seen_urls: set[str] = set()
    extracted_items: list[ExtractedNewsletterItem] = []
    for candidate in parser.links:
        url = candidate["url"].strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        extracted_items.append(
            ExtractedNewsletterItem(
                url=url,
                title=candidate["title"] or subject or url,
                excerpt=raw_text[:500].strip(),
                position=len(extracted_items) + 1,
            )
        )

    for match in URL_PATTERN.finditer(raw_text):
        url = match.group(0).rstrip(".,)")
        if url in seen_urls:
            continue
        seen_urls.add(url)
        extracted_items.append(
            ExtractedNewsletterItem(
                url=url,
                title=subject or url,
                excerpt=raw_text[:500].strip(),
                position=len(extracted_items) + 1,
            )
        )

    return extracted_items


def _normalize_llm_items(
    raw_items: object,
    *,
    subject: str,
    raw_text: str,
) -> list[ExtractedNewsletterItem]:
    """Normalize OpenRouter extraction results into saved newsletter items."""

    if not isinstance(raw_items, list):
        return []

    normalized_items: list[ExtractedNewsletterItem] = []
    seen_urls: set[str] = set()
    fallback_excerpt = raw_text[:500].strip()

    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            continue
        url = str(raw_item.get("url", "")).strip().rstrip(".,)")
        if not url.startswith(("http://", "https://")) or url in seen_urls:
            continue
        seen_urls.add(url)
        title = str(raw_item.get("title", "")).strip() or subject or url
        excerpt = str(raw_item.get("excerpt", "")).strip() or fallback_excerpt
        normalized_items.append(
            ExtractedNewsletterItem(
                url=url,
                title=title,
                excerpt=excerpt,
                position=len(normalized_items) + 1,
            )
        )

    return normalized_items
