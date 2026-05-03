"""Helpers for emitting persistent user notifications from backend workflows."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.conf import settings

from notifications.models import Notification, NotificationLevel
from projects.models import ProjectRole


def notify(
    user,
    *,
    level: str = NotificationLevel.INFO,
    body: str,
    link_path: str = "",
    project=None,
    metadata: Mapping[str, Any] | None = None,
) -> Notification | None:
    """Create a persistent notification when messaging is enabled."""

    if not getattr(settings, "MESSAGING_ENABLED", False):
        return None
    return Notification.objects.create(
        user=user,
        project=project,
        level=level,
        body=body,
        link_path=link_path,
        metadata=dict(metadata or {}),
    )


def notify_project_admins(
    project,
    *,
    level: str = NotificationLevel.INFO,
    body: str,
    link_path: str = "",
    metadata: Mapping[str, Any] | None = None,
) -> int:
    """Create one notification for each admin member of a project."""

    created_count = 0
    memberships = project.memberships.select_related("user").filter(
        role=ProjectRole.ADMIN
    )
    for membership in memberships:
        created = notify(
            membership.user,
            level=level,
            body=body,
            link_path=link_path,
            project=project,
            metadata=metadata,
        )
        if created is not None:
            created_count += 1
    return created_count
