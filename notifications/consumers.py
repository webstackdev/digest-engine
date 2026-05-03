"""WebSocket consumers for live notification delivery."""

from __future__ import annotations

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings

from notifications.realtime import notification_group_name


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Stream new notifications to the authenticated user's browser session."""

    group_name: str | None = None

    async def connect(self) -> None:
        """Authenticate the websocket and subscribe it to the user's group."""

        if not getattr(settings, "MESSAGING_ENABLED", False):
            await self.close(code=4404)
            return

        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.group_name = notification_group_name(int(user.pk))
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code: int) -> None:
        """Remove the websocket from its channel-layer group on disconnect."""

        if self.group_name is not None:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_created(self, event: dict[str, object]) -> None:
        """Send the created-notification event payload to the browser client."""

        await self.send_json(
            {
                "type": "notification.created",
                "notification": event["notification"],
            }
        )
