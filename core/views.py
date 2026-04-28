"""Operational and newsletter-intake views used outside the REST API."""

from http import HTTPStatus
from typing import cast

from django.conf import settings as django_settings
from django.db import connection
from django.http import HttpRequest, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET
from qdrant_client import QdrantClient

from core.models import IntakeAllowlist, NewsletterIntake, NewsletterIntakeStatus
from core.newsletters import queue_newsletter_intake
from core.settings_types import CoreSettings

settings = cast(CoreSettings, django_settings)


def healthz_view(request):
    """Return a lightweight liveness response for load balancers and probes."""

    return JsonResponse(
        {"status": "ok", "service": "newsletter-maker"}, status=HTTPStatus.OK
    )


def readyz_view(request):
    """Return readiness status based on the database and Qdrant dependencies."""

    checks = {
        "database": _check_database(),
        "qdrant": _check_qdrant(),
    }
    status = HTTPStatus.OK if all(checks.values()) else HTTPStatus.SERVICE_UNAVAILABLE
    payload = {
        "status": "ready" if status == HTTPStatus.OK else "degraded",
        "checks": checks,
    }
    return JsonResponse(payload, status=status)


def _check_database() -> bool:
    """Verify the application can execute a trivial SQL query."""

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return False
    return True


def _check_qdrant() -> bool:
    """Verify the application can reach the configured Qdrant instance."""

    try:
        client = QdrantClient(
            url=settings.QDRANT_URL, timeout=2, check_compatibility=False
        )
        client.get_collections()
    except Exception:
        return False
    return True


@require_GET
def confirm_newsletter_sender_view(request: HttpRequest, token: str):
    """Confirm a sender and queue any pending newsletter intake rows.

    Args:
        request: Incoming confirmation request.
        token: Confirmation token stored on the allowlist entry.

    Returns:
        A JSON response showing that the sender was confirmed and how many pending
        intake rows were queued for processing.
    """

    allowlist = get_object_or_404(IntakeAllowlist, confirmation_token=token)
    if allowlist.confirmed_at is None:
        allowlist.confirmed_at = timezone.now()
        allowlist.save(update_fields=["confirmed_at"])

    pending_intake_ids = list(
        NewsletterIntake.objects.filter(
            project=allowlist.project,
            sender_email=allowlist.sender_email,
            status=NewsletterIntakeStatus.PENDING,
        ).values_list("id", flat=True)
    )
    for intake_id in pending_intake_ids:
        queue_newsletter_intake(intake_id)

    return JsonResponse({"status": "confirmed", "queued": len(pending_intake_ids)})
