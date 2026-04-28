from __future__ import annotations

import re
from dataclasses import dataclass
from html.parser import HTMLParser

URL_PATTERN = re.compile(r"https?://[^\s<>'\"]+")


@dataclass(slots=True)
class ExtractedNewsletterItem:
    url: str
    title: str
    excerpt: str
    position: int


class _NewsletterLinkParser(HTMLParser):
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
                "title": " ".join(part.strip() for part in self._active_text if part.strip()),
            }
        )
        self._active_href = None
        self._active_text = []


def extract_newsletter_items(*, subject: str, raw_html: str, raw_text: str) -> list[ExtractedNewsletterItem]:
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
