"""WebSocket routes for the messaging app."""

from django.urls import path

from messaging.consumers import ThreadConsumer

websocket_urlpatterns = [
    path("ws/messages/<int:thread_id>/", ThreadConsumer.as_asgi()),
]
