"""REST API endpoints for direct-message threads."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.api import AUTHENTICATION_REQUIRED_RESPONSE
from messaging.models import DirectMessage, Thread, ThreadParticipant
from messaging.serializers import (
    DirectMessageCreateSerializer,
    DirectMessageSerializer,
    ThreadCreateSerializer,
    ThreadSerializer,
)


@extend_schema_view(
    list=extend_schema(
        summary="List direct-message threads",
        description="Return the current user's 1:1 messaging threads, newest first.",
        tags=["Messaging"],
        responses={
            200: ThreadSerializer(many=True),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
    ),
    create=extend_schema(
        summary="Open or find a direct-message thread",
        description="Find an existing 1:1 thread with another visible user or create it.",
        tags=["Messaging"],
        request=ThreadCreateSerializer,
        responses={201: ThreadSerializer, 403: AUTHENTICATION_REQUIRED_RESPONSE},
    ),
)
class ThreadViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """List, create, and interact with the current user's direct-message threads."""

    permission_classes = [IsAuthenticated]
    serializer_class = ThreadSerializer
    queryset = Thread.objects.all()
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        """Limit threads to those the authenticated user participates in."""

        user_model = get_user_model()
        return (
            self.queryset.filter(participants=self.request.user)
            .prefetch_related(
                Prefetch(
                    "participants",
                    queryset=user_model.objects.all(),
                ),
                Prefetch(
                    "participant_states",
                    queryset=ThreadParticipant.objects.filter(user=self.request.user),
                    to_attr="current_participant_states",
                ),
                Prefetch(
                    "messages",
                    queryset=DirectMessage.objects.select_related("sender").order_by(
                        "-created_at"
                    ),
                    to_attr="prefetched_messages",
                ),
            )
            .distinct()
        )

    def create(self, request, *args, **kwargs):
        """Find or create the direct-message thread for the requested recipient."""

        input_serializer = ThreadCreateSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        input_serializer.is_valid(raise_exception=True)
        thread = input_serializer.save()
        thread = self.get_queryset().get(pk=thread.pk)
        output_serializer = self.get_serializer(thread)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="List thread messages",
        description="Return messages for one direct-message thread.",
        tags=["Messaging"],
        responses={
            200: DirectMessageSerializer(many=True),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
    )
    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, *args, **kwargs):
        """List or send messages within one thread."""

        thread = self.get_object()
        if request.method.lower() == "get":
            serializer = DirectMessageSerializer(
                thread.messages.select_related("sender").all(),
                many=True,
            )
            return Response(serializer.data)

        input_serializer = DirectMessageCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        message = DirectMessage.objects.create(
            thread=thread,
            sender=request.user,
            body=input_serializer.validated_data["body"],
        )
        thread.last_message_at = message.created_at
        thread.save(update_fields=["last_message_at"])
        ThreadParticipant.objects.filter(thread=thread, user=request.user).update(
            last_read_at=message.created_at
        )
        output_serializer = DirectMessageSerializer(message)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Mark a thread as read",
        description="Update the current user's last-read cursor for one thread.",
        tags=["Messaging"],
        request=None,
        responses={
            200: OpenApiResponse(description="Thread marked as read."),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
    )
    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, *args, **kwargs):
        """Move the current user's read cursor to the latest message."""

        thread = self.get_object()
        participant_state = thread.participant_states.get(user=request.user)
        participant_state.last_read_at = thread.last_message_at or timezone.now()
        participant_state.save(update_fields=["last_read_at"])
        return Response(
            {
                "thread_id": int(thread.pk),
                "last_read_at": participant_state.last_read_at,
            }
        )
