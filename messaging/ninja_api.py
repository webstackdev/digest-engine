"""Django Ninja endpoints for direct-message threads."""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast

from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Schema
from ninja.responses import Status

from core.ninja_api import drf_authenticate
from messaging.models import DirectMessage, Thread, ThreadParticipant
from messaging.serializers import (
    DirectMessageCreateSerializer,
    DirectMessageSerializer,
    ThreadCreateSerializer,
    ThreadSerializer,
)

router = Router(tags=["Messaging"])


class ThreadCounterpartSchema(Schema):
    """The other participant shown in a 1:1 thread."""

    id: int
    username: str
    display_name: str
    avatar_url: str | None = None
    avatar_thumbnail_url: str | None = None


class ThreadSchema(Schema):
    """Serialized direct-message thread summary."""

    id: int
    counterpart: ThreadCounterpartSchema | None = None
    has_unread: bool
    last_message_preview: str
    last_message_at: datetime | None = None
    last_read_at: datetime | None = None
    created_at: datetime


class ThreadCreateInput(Schema):
    """Input payload for opening or finding a direct-message thread."""

    recipient_user_id: int
    opening_message: str | None = None


class DirectMessageSchema(Schema):
    """Serialized direct message payload."""

    id: int
    thread: int
    sender: int
    sender_username: str
    sender_display_name: str
    body: str
    created_at: datetime
    edited_at: datetime | None = None


class DirectMessageCreateInput(Schema):
    """Input payload for posting one direct message."""

    body: str


class ThreadReadResponseSchema(Schema):
    """Response body for the thread read action."""

    thread_id: int
    last_read_at: datetime | None = None


def _threads_queryset(request) -> Any:
    """Return the current user's visible thread queryset."""

    user_model = get_user_model()
    return (
        Thread.objects.filter(participants=request.user)
        .prefetch_related(
            Prefetch("participants", queryset=user_model.objects.all()),
            Prefetch(
                "participant_states",
                queryset=ThreadParticipant.objects.filter(user=request.user),
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


def _serialize_threads(request, threads: list[Thread]) -> list[dict[str, Any]]:
    """Return serialized thread payloads."""

    serializer = ThreadSerializer(threads, many=True, context={"request": request})
    return cast(list[dict[str, Any]], serializer.data)


def _serialize_thread(request, thread: Thread) -> dict[str, Any]:
    """Return one serialized thread payload."""

    serializer = ThreadSerializer(thread, context={"request": request})
    return cast(dict[str, Any], serializer.data)


def _serialize_messages(messages: list[DirectMessage]) -> list[dict[str, Any]]:
    """Return serialized direct message payloads."""

    serializer = DirectMessageSerializer(messages, many=True)
    return cast(list[dict[str, Any]], serializer.data)


def _serialize_message(message: DirectMessage) -> dict[str, Any]:
    """Return one serialized direct message payload."""

    serializer = DirectMessageSerializer(message)
    return cast(dict[str, Any], serializer.data)


def _get_thread_for_request(request, thread_id: int) -> Thread:
    """Return one thread visible to the current user or 404."""

    return get_object_or_404(_threads_queryset(request), pk=thread_id)


@router.get("/messaging/threads/", response=list[ThreadSchema], auth=drf_authenticate)
def list_threads(request):
    """Return the current user's 1:1 messaging threads, newest first."""

    return _serialize_threads(request, list(_threads_queryset(request)))


@router.post("/messaging/threads/", response={201: ThreadSchema}, auth=drf_authenticate)
def create_thread(request, payload: ThreadCreateInput):
    """Find an existing 1:1 thread with another visible user or create it."""

    serializer = ThreadCreateSerializer(
        data=payload.model_dump(exclude_unset=True),
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    thread = serializer.save()
    hydrated_thread = _threads_queryset(request).get(pk=thread.pk)
    return Status(201, _serialize_thread(request, hydrated_thread))


@router.get(
    "/messaging/threads/{thread_id}/messages/",
    response=list[DirectMessageSchema],
    auth=drf_authenticate,
)
def list_thread_messages(request, thread_id: int):
    """Return messages for one direct-message thread."""

    thread = _get_thread_for_request(request, thread_id)
    messages = list(thread.messages.select_related("sender").all())
    return _serialize_messages(messages)


@router.post(
    "/messaging/threads/{thread_id}/messages/",
    response={201: DirectMessageSchema},
    auth=drf_authenticate,
)
def create_thread_message(request, thread_id: int, payload: DirectMessageCreateInput):
    """Send one direct message in the specified thread."""

    thread = _get_thread_for_request(request, thread_id)
    serializer = DirectMessageCreateSerializer(
        data=payload.model_dump(exclude_unset=True)
    )
    serializer.is_valid(raise_exception=True)
    message = DirectMessage.objects.create(
        thread=thread,
        sender=request.user,
        body=serializer.validated_data["body"],
    )
    thread.last_message_at = message.created_at
    thread.save(update_fields=["last_message_at"])
    ThreadParticipant.objects.filter(thread=thread, user=request.user).update(
        last_read_at=message.created_at
    )
    return Status(201, _serialize_message(message))


@router.post(
    "/messaging/threads/{thread_id}/read/",
    response=ThreadReadResponseSchema,
    auth=drf_authenticate,
)
def read_thread(request, thread_id: int):
    """Move the current user's read cursor to the latest message."""

    thread = _get_thread_for_request(request, thread_id)
    participant_state = thread.participant_states.get(user=request.user)
    participant_state.last_read_at = thread.last_message_at or timezone.now()
    participant_state.save(update_fields=["last_read_at"])
    return {
        "thread_id": int(thread.pk),
        "last_read_at": participant_state.last_read_at,
    }


__all__ = ["router"]
