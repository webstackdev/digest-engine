"""Signal handlers that broadcast new direct messages to live thread sessions."""

from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from messaging.models import DirectMessage
from messaging.realtime import serialize_message, thread_group_name


@receiver(post_save, sender=DirectMessage)
def broadcast_direct_message_created(sender, instance, created, **kwargs) -> None:
    """Broadcast newly-created direct messages to the thread's live sessions."""

    if kwargs.get("raw") or not created or not settings.MESSAGING_ENABLED:
        return

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        thread_group_name(int(instance.thread_id)),
        {
            "type": "message.created",
            "message": serialize_message(instance),
        },
    )
