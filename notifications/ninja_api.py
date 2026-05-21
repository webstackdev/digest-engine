"""Django Ninja endpoints for the notifications API."""

from __future__ import annotations

from typing import Any

from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Query, Router, Schema
from ninja.responses import Status

from core.ninja_api import drf_authenticate
from notifications.models import Notification

router = Router(tags=["Notifications"])


class NotificationSchema(Schema):
    """Serialized notification payload."""

    id: int
    project: int | None = None
    level: str
    body: str
    link_path: str
    metadata: dict[str, Any]
    created_at: str
    read_at: str | None = None
    is_read: bool


class NotificationListFilters(Schema):
    """Supported filters for listing notifications."""

    unread: str | None = None


class NotificationsReadAllResponseSchema(Schema):
    """Response body for the read-all action."""

    updated_count: int


def _serialize_notification(notification: Notification) -> dict[str, Any]:
    """Return one serialized notification payload."""

    return {
        "id": int(notification.pk),
        "project": notification.project_id,
        "level": notification.level,
        "body": notification.body,
        "link_path": notification.link_path,
        "metadata": notification.metadata,
        "created_at": notification.created_at.isoformat(),
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
        "is_read": notification.is_read,
    }


def _serialize_notifications(notifications: list[Notification]) -> list[dict[str, Any]]:
    """Return serialized notification payloads for a list response."""

    return [_serialize_notification(notification) for notification in notifications]


def _notifications_queryset(request) -> Any:
    """Return the current user's notification queryset."""

    return Notification.objects.select_related("project").filter(user=request.user)


@router.get("/notifications/", response=list[NotificationSchema], auth=drf_authenticate)
def list_notifications(request, filters: Query[NotificationListFilters]):
    """Return the current user's notifications, newest first."""

    queryset = _notifications_queryset(request)
    unread_value = (filters.unread or "").lower()
    if unread_value in {"1", "true", "yes", "on"}:
        queryset = queryset.filter(read_at__isnull=True)
    return _serialize_notifications(list(queryset))


@router.post(
    "/notifications/read-all/",
    response=NotificationsReadAllResponseSchema,
    auth=drf_authenticate,
)
def read_all_notifications(request):
    """Mark every unread notification as read for the current user."""

    updated_count = (
        _notifications_queryset(request)
        .filter(read_at__isnull=True)
        .update(read_at=timezone.now())
    )
    return {"updated_count": updated_count}


@router.delete(
    "/notifications/{notification_id}/", auth=drf_authenticate, response={204: None}
)
def delete_notification(request, notification_id: int):
    """Delete one notification from the current user's inbox."""

    notification = get_object_or_404(
        _notifications_queryset(request), pk=notification_id
    )
    notification.delete()
    return Status(204, None)


@router.post(
    "/notifications/{notification_id}/read/",
    response=NotificationSchema,
    auth=drf_authenticate,
)
def read_notification(request, notification_id: int):
    """Mark one notification as read and return the updated payload."""

    notification = get_object_or_404(
        _notifications_queryset(request), pk=notification_id
    )
    if notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
    return _serialize_notification(notification)


__all__ = ["router"]
