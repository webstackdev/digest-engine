"""Signal handlers that adapt Anymail inbound events to project intake logic."""

from __future__ import annotations

from anymail.signals import inbound
from django.dispatch import receiver

from core.newsletters import process_inbound_newsletter


def _address_to_string(address) -> str:
    """Normalize an Anymail address object or string into plain text."""

    if address is None:
        return ""
    addr_spec = getattr(address, "addr_spec", None)
    if isinstance(addr_spec, str):
        return addr_spec.strip()
    return str(address).strip()


@receiver(inbound)
def handle_anymail_inbound(sender, event, esp_name, **kwargs):
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
