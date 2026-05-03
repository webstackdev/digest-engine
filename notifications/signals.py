"""Signal handlers that broadcast new notifications to live websocket sessions."""

from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from notifications.models import Notification
from notifications.realtime import notification_group_name, serialize_notification


@receiver(post_save, sender=Notification)
def broadcast_notification_created(sender, instance, created, **kwargs) -> None:
    """Broadcast newly-created notifications to the recipient's live sessions."""

    if kwargs.get("raw") or not created or not settings.MESSAGING_ENABLED:
        return

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        notification_group_name(int(instance.user_id)),
        {
            "type": "notification.created",
            "notification": serialize_notification(instance),
        },
    )
