"""Realtime notification helpers shared by signals and consumers."""

from notifications.models import Notification
from notifications.serializers import NotificationSerializer


def notification_group_name(user_id: int) -> str:
    """Return the channel-layer group name for one user's notification stream."""

    return f"notif.{user_id}"


def serialize_notification(notification: Notification) -> dict[str, object]:
    """Return the websocket payload for a persisted notification row."""

    return NotificationSerializer(notification).data
