"""Compatibility exports for newsletter intake helpers."""

from newsletters.intake import (
    build_confirmation_url,
    extract_newsletter_items,
    normalize_sender_email,
    process_inbound_newsletter,
    queue_newsletter_intake,
    sanitize_newsletter_html,
    send_confirmation_email,
)

__all__ = [
    "build_confirmation_url",
    "extract_newsletter_items",
    "normalize_sender_email",
    "process_inbound_newsletter",
    "queue_newsletter_intake",
    "sanitize_newsletter_html",
    "send_confirmation_email",
]
