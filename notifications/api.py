"""User-scoped REST endpoints for persistent notifications."""

from __future__ import annotations

from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api import AUTHENTICATION_REQUIRED_RESPONSE
from notifications.models import Notification
from notifications.serializers import NotificationSerializer

READ_ALL_RESPONSE = inline_serializer(
    name="NotificationsReadAllResponse",
    fields={
        "updated_count": serializers.IntegerField(),
    },
)


@extend_schema_view(
    list=extend_schema(
        summary="List notifications",
        description="Return the current user's persistent notifications, newest first.",
        tags=["Notifications"],
        responses={
            200: NotificationSerializer(many=True),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
    ),
    destroy=extend_schema(
        summary="Delete notification",
        description="Delete one notification from the current user's inbox.",
        tags=["Notifications"],
        responses={
            204: OpenApiResponse(description="Notification deleted."),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
    ),
)
class NotificationViewSet(
    mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """List and manage the authenticated user's notifications."""

    serializer_class = NotificationSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    queryset = Notification.objects.select_related("project")

    def get_queryset(self):
        """Scope notifications to the authenticated user and optional unread filter."""

        queryset = self.queryset.filter(user=self.request.user)
        unread_value = self.request.query_params.get("unread", "")
        if unread_value.lower() in {"1", "true", "yes", "on"}:
            queryset = queryset.filter(read_at__isnull=True)
        return queryset

    @extend_schema(
        summary="Mark notification as read",
        description="Set `read_at` for one notification owned by the current user.",
        tags=["Notifications"],
        request=None,
        responses={200: NotificationSerializer, 403: AUTHENTICATION_REQUIRED_RESPONSE},
    )
    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, *args, **kwargs):
        """Mark one notification as read and return the updated payload."""

        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @extend_schema(
        summary="Mark all notifications as read",
        description="Set `read_at` for every unread notification owned by the current user.",
        tags=["Notifications"],
        request=None,
        responses={200: READ_ALL_RESPONSE, 403: AUTHENTICATION_REQUIRED_RESPONSE},
    )
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request, *args, **kwargs):
        """Mark every unread notification as read for the current user."""

        updated_count = (
            self.get_queryset()
            .filter(read_at__isnull=True)
            .update(read_at=timezone.now())
        )
        return Response({"updated_count": updated_count}, status=status.HTTP_200_OK)
