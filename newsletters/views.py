"""Newsletter-intake views used outside the REST API."""

from django.http import HttpRequest, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET

from newsletters.intake import queue_newsletter_intake
from newsletters.models import IntakeAllowlist, NewsletterIntake, NewsletterIntakeStatus


@require_GET
def confirm_newsletter_sender_view(request: HttpRequest, token: str):
    """Confirm a sender and queue any pending newsletter intake rows."""

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
