"""
ASGI config for newsletter_maker project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

from messaging.routing import websocket_urlpatterns as messaging_websocket_urlpatterns
from newsletter_maker.telemetry import configure_telemetry
from notifications.routing import (
    websocket_urlpatterns as notification_websocket_urlpatterns,
)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "newsletter_maker.settings")

configure_telemetry(instrument_django=True)

django_asgi_application = get_asgi_application()

application = ProtocolTypeRouter(
    {
        "http": django_asgi_application,
        "websocket": AuthMiddlewareStack(
            URLRouter(
                [
                    *notification_websocket_urlpatterns,
                    *messaging_websocket_urlpatterns,
                ]
            )
        ),
    }
)
