"""WebSocket consumers for live direct-message delivery."""

from __future__ import annotations

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings

from messaging.models import ThreadParticipant
from messaging.realtime import thread_group_name


class ThreadConsumer(AsyncJsonWebsocketConsumer):
    """Stream new direct messages for one authenticated participant thread."""

    group_name: str | None = None

    async def connect(self) -> None:
        """Authenticate the websocket and subscribe it to one thread group."""

        if not getattr(settings, "MESSAGING_ENABLED", False):
            await self.close(code=4404)
            return

        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        url_route = self.scope.get("url_route")
        kwargs = url_route.get("kwargs") if isinstance(url_route, dict) else None
        thread_id = kwargs.get("thread_id") if isinstance(kwargs, dict) else None
        if thread_id is None:
            await self.close(code=4404)
            return

        is_participant = await ThreadParticipant.objects.filter(
            thread_id=thread_id,
            user_id=user.pk,
        ).aexists()
        if not is_participant:
            await self.close(code=4403)
            return

        self.group_name = thread_group_name(int(thread_id))
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code: int) -> None:
        """Remove the socket from the thread group on disconnect."""

        if self.group_name is not None:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def message_created(self, event: dict[str, object]) -> None:
        """Send the created-message payload to the browser client."""

        await self.send_json(
            {
                "type": "message.created",
                "message": event["message"],
            }
        )
