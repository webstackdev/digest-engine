"""Shared helpers for direct-message realtime delivery."""

from __future__ import annotations

from messaging.models import DirectMessage


def thread_group_name(thread_id: int) -> str:
    """Return the channel-layer group name for one thread."""

    return f"thread.{thread_id}"


def serialize_message(message: DirectMessage) -> dict[str, object]:
    """Return the websocket payload shape for one direct message."""

    sender = message.sender
    return {
        "id": int(message.pk),
        "thread": int(message.thread_id),
        "sender": int(message.sender_id),
        "sender_username": sender.username,
        "sender_display_name": sender.display_name or sender.username,
        "body": message.body,
        "created_at": message.created_at.isoformat().replace("+00:00", "Z"),
        "edited_at": (
            message.edited_at.isoformat().replace("+00:00", "Z")
            if message.edited_at is not None
            else None
        ),
    }
