"""Helpers for canonical URL normalization used by content deduplication."""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx

TRACKING_QUERY_KEYS = frozenset(
    {
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
        "ref",
        "ref_src",
        "s",
        "t",
    }
)
KNOWN_SHORTENER_HOSTS = frozenset({"bit.ly", "buff.ly", "lnkd.in", "t.co"})


def canonicalize_url(raw_url: str) -> str:
    """Normalize a URL into a stable canonical form for deduplication."""

    if not raw_url:
        return ""

    resolved_url = _resolve_known_shortener(raw_url.strip())
    parsed_url = urlsplit(resolved_url)
    scheme = (parsed_url.scheme or "https").lower()
    hostname = (parsed_url.hostname or "").lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]

    netloc = hostname
    if parsed_url.port and not _is_default_port(scheme, parsed_url.port):
        netloc = f"{hostname}:{parsed_url.port}"

    path = parsed_url.path or "/"
    if path != "/":
        path = path.rstrip("/") or "/"

    filtered_query = urlencode(
        [
            (key, value)
            for key, value in parse_qsl(parsed_url.query, keep_blank_values=True)
            if not _should_drop_query_parameter(key)
        ],
        doseq=True,
    )

    return urlunsplit((scheme, netloc, path, filtered_query, ""))


def _resolve_known_shortener(raw_url: str) -> str:
    """Expand a supported short URL when the network request succeeds."""

    hostname = (urlsplit(raw_url).hostname or "").lower()
    if hostname not in KNOWN_SHORTENER_HOSTS:
        return raw_url

    try:
        response = httpx.head(raw_url, follow_redirects=True, timeout=5.0)
        response.raise_for_status()
    except httpx.HTTPError:
        return raw_url
    return str(response.url)


def _should_drop_query_parameter(key: str) -> bool:
    normalized_key = key.lower()
    return normalized_key.startswith("utm_") or normalized_key in TRACKING_QUERY_KEYS


def _is_default_port(scheme: str, port: int) -> bool:
    return (scheme == "http" and port == 80) or (scheme == "https" and port == 443)