"""Realtime notification helpers shared by signals and consumers."""

from notifications.models import Notification


def notification_group_name(user_id: int) -> str:
    """Return the channel-layer group name for one user's notification stream."""

    return f"notif.{user_id}"


def serialize_notification(notification: Notification) -> dict[str, object]:
    """Return the websocket payload for a persisted notification row."""

    return {
        "id": int(notification.pk),
        "project": notification.project_id,
        "level": notification.level,
        "body": notification.body,
        "link_path": notification.link_path,
        "metadata": notification.metadata,
        "created_at": notification.created_at,
        "read_at": notification.read_at,
        "is_read": notification.is_read,
    }
