"""Signal handlers that adapt Anymail inbound events to project intake logic."""

from __future__ import annotations

from typing import Any

from anymail.signals import inbound
from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import UserFeedback
from core.newsletters import process_inbound_newsletter
from core.tasks import queue_topic_centroid_recompute
from projects.models import ProjectConfig


def _address_to_string(address) -> str:
    """Normalize an Anymail address object or string into plain text."""

    if address is None:
        return ""
    addr_spec = getattr(address, "addr_spec", None)
    if isinstance(addr_spec, str):
        return addr_spec.strip()
    return str(address).strip()


@receiver(inbound)
def handle_anymail_inbound(
    sender: Any,
    event: Any,
    esp_name: str,
    **kwargs: Any,
) -> None:
    """Translate an inbound Anymail event into the internal intake payload.

    Args:
        sender: Signal sender supplied by Anymail.
        event: Normalized inbound event object.
        esp_name: Name of the email service provider that generated the event.
        **kwargs: Additional Anymail signal metadata.
    """

    message = event.message

    recipients: list[str] = []
    if message.envelope_recipient:
        recipients.append(message.envelope_recipient)
    recipients.extend(
        address.addr_spec
        for address in getattr(message, "to", [])
        if getattr(address, "addr_spec", "")
    )

    process_inbound_newsletter(
        recipients=recipients,
        sender_email=message.envelope_sender
        or _address_to_string(getattr(message, "from_email", None)),
        subject=message.subject or "",
        raw_html=message.html or "",
        raw_text=message.text or "",
        message_id=str(message.get("Message-ID", "") or event.event_id or ""),
    )


@receiver(post_save, sender=UserFeedback)
def queue_topic_centroid_on_feedback_save(sender, instance, created, **kwargs):
    """Queue centroid recomputation when feedback changes and config allows it."""

    if kwargs.get("raw"):
        return

    config, _ = ProjectConfig.objects.get_or_create(project=instance.project)
    if config.recompute_topic_centroid_on_feedback_save:
        queue_topic_centroid_recompute(instance.project_id)
