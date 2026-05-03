"""Consumer tests for live notification delivery over websockets."""

from __future__ import annotations

from unittest.mock import AsyncMock

from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings

from notifications.consumers import NotificationConsumer
from projects.models import Project


@override_settings(
    MESSAGING_ENABLED=True,
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}},
)
class NotificationConsumerTests(TransactionTestCase):
    """Verify new notifications are pushed to authenticated websocket clients."""

    def setUp(self) -> None:
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="socket-user",
            password="testpass123",
        )
        self.project = Project.objects.create(
            name="Socket Project",
            topic_description="Realtime",
        )

    def test_authenticated_user_joins_user_group_on_connect(self) -> None:
        consumer = NotificationConsumer()
        consumer.scope = {"user": self.user}
        consumer.channel_layer = AsyncMock()
        consumer.channel_name = "test-channel"
        consumer.accept = AsyncMock()

        async_to_sync(consumer.connect)()

        consumer.channel_layer.group_add.assert_awaited_once_with(
            f"notif.{self.user.pk}",
            "test-channel",
        )
        consumer.accept.assert_awaited_once()
