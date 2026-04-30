"""Signal handlers for cross-cutting core behaviors."""

from __future__ import annotations

from typing import Any

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import UserFeedback
from newsletters.signals import handle_anymail_inbound as _handle_anymail_inbound
from projects.models import ProjectConfig
from trends.tasks import queue_topic_centroid_recompute


def handle_anymail_inbound(
    sender: Any,
    event: Any,
    esp_name: str,
    **kwargs: Any,
) -> None:
    """Preserve the legacy core.signals import path for inbound handling."""

    _handle_anymail_inbound(
        sender=sender,
        event=event,
        esp_name=esp_name,
        **kwargs,
    )


@receiver(post_save, sender=UserFeedback)
def queue_topic_centroid_on_feedback_save(sender, instance, created, **kwargs):
    """Queue centroid recomputation when feedback changes and config allows it."""

    if kwargs.get("raw"):
        return

    config, _ = ProjectConfig.objects.get_or_create(project=instance.project)
    if config.recompute_topic_centroid_on_feedback_save:
        queue_topic_centroid_recompute(instance.project_id)
