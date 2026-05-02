"""Signal handlers for content-owned behaviors."""

from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from content.models import UserFeedback
from projects.models import ProjectConfig
from trends.tasks import queue_topic_centroid_recompute


@receiver(post_save, sender=UserFeedback)
def queue_topic_centroid_on_feedback_save(sender, instance, created, **kwargs):
    """Queue centroid recomputation when feedback changes and config allows it."""

    if kwargs.get("raw"):
        return

    config, _ = ProjectConfig.objects.get_or_create(project=instance.project)
    if config.recompute_topic_centroid_on_feedback_save:
        queue_topic_centroid_recompute(instance.project_id)
