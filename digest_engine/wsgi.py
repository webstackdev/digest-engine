"""
WSGI config for digest_engine project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

from digest_engine.telemetry import configure_telemetry

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "digest_engine.settings")

configure_telemetry(instrument_django=True)

application = get_wsgi_application()
