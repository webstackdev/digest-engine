"""Django Ninja endpoints for direct-message threads."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Schema
from ninja.responses import Status

from core.ninja_api import drf_authenticate
from messaging.models import (
    DirectMessage,
    Thread,
    ThreadParticipant,
    users_share_project,
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

    return [_serialize_thread(request, thread) for thread in threads]


def _serialize_thread(request, thread: Thread) -> dict[str, Any]:
    """Return one serialized thread payload."""

    current_user_id = int(request.user.pk)
    participant_states = getattr(thread, "current_participant_states", None)
    participant_state = (
        participant_states[0]
        if participant_states
        else thread.participant_states.filter(user_id=current_user_id).first()
    )
    prefetched_messages = getattr(thread, "prefetched_messages", None)
    messages = (
        list(prefetched_messages)
        if prefetched_messages is not None
        else list(thread.messages.select_related("sender").order_by("-created_at"))
    )
    counterpart = next(
        (
            participant
            for participant in thread.participants.all()
            if int(participant.pk) != current_user_id
        ),
        None,
    )
    last_read_at = participant_state.last_read_at if participant_state else None
    return {
        "id": int(thread.pk),
        "counterpart": (
            {
                "id": int(counterpart.pk),
                "username": counterpart.username,
                "display_name": counterpart.display_name or counterpart.username,
                "avatar_url": counterpart.avatar_url,
                "avatar_thumbnail_url": counterpart.avatar_thumbnail_url,
            }
            if counterpart is not None
            else None
        ),
        "has_unread": any(
            message.sender_id != current_user_id
            and (last_read_at is None or message.created_at > last_read_at)
            for message in messages
        ),
        "last_message_preview": messages[0].body[:140] if messages else "",
        "last_message_at": thread.last_message_at,
        "last_read_at": last_read_at,
        "created_at": thread.created_at,
    }


def _serialize_messages(messages: list[DirectMessage]) -> list[dict[str, Any]]:
    """Return serialized direct message payloads."""

    return [_serialize_message(message) for message in messages]


def _serialize_message(message: DirectMessage) -> dict[str, Any]:
    """Return one serialized direct message payload."""

    return {
        "id": int(message.pk),
        "thread": message.thread_id,
        "sender": message.sender_id,
        "sender_username": message.sender.username,
        "sender_display_name": message.sender.display_name or message.sender.username,
        "body": message.body,
        "created_at": message.created_at,
        "edited_at": message.edited_at,
    }


def _error_payload(field: str, message: str) -> dict[str, list[str]]:
    """Return the native Ninja validation payload shape."""

    return {field: [message]}


def _validated_thread_payload(
    payload: dict[str, Any],
    *,
    request,
) -> tuple[dict[str, Any], dict[str, list[str]] | None]:
    """Normalize and validate one thread-create payload."""

    validated_payload = dict(payload)
    recipient_user_id = int(validated_payload["recipient_user_id"])
    if recipient_user_id == int(request.user.pk):
        return validated_payload, _error_payload(
            "recipient_user_id", "You cannot message yourself."
        )

    user_model = get_user_model()
    if not user_model.objects.filter(pk=recipient_user_id).exists():
        return validated_payload, _error_payload(
            "recipient_user_id", "Recipient not found."
        )

    if not users_share_project(int(request.user.pk), recipient_user_id):
        return validated_payload, _error_payload(
            "recipient_user_id",
            "You can only message users who share a project with you.",
        )

    validated_payload["opening_message"] = str(
        validated_payload.get("opening_message", "")
    ).strip()
    return validated_payload, None


def _validated_message_body(
    body: str,
) -> tuple[str | None, dict[str, list[str]] | None]:
    """Normalize and validate one outbound direct-message body."""

    normalized = body.strip()
    if not normalized:
        return None, _error_payload("body", "This field may not be blank.")
    return normalized, None


def _get_thread_for_request(request, thread_id: int) -> Thread:
    """Return one thread visible to the current user or 404."""

    return get_object_or_404(_threads_queryset(request), pk=thread_id)


@router.get("/messaging/threads/", response=list[ThreadSchema], auth=drf_authenticate)
def list_threads(request):
    """Return the current user's 1:1 messaging threads, newest first."""

    return _serialize_threads(request, list(_threads_queryset(request)))


@router.post(
    "/messaging/threads/",
    response={201: ThreadSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def create_thread(request, payload: ThreadCreateInput):
    """Find an existing 1:1 thread with another visible user or create it."""

    validated_payload, errors = _validated_thread_payload(
        payload.model_dump(exclude_unset=True),
        request=request,
    )
    if errors is not None:
        return Status(400, errors)

    recipient_user_id = int(validated_payload["recipient_user_id"])
    opening_message = str(validated_payload.get("opening_message", ""))

    thread = Thread.find_between_users(int(request.user.pk), recipient_user_id)
    if thread is None:
        thread = Thread.objects.create()
        ThreadParticipant.objects.bulk_create(
            [
                ThreadParticipant(thread=thread, user=request.user),
                ThreadParticipant(thread=thread, user_id=recipient_user_id),
            ]
        )

    if opening_message:
        message = DirectMessage.objects.create(
            thread=thread,
            sender=request.user,
            body=opening_message,
        )
        thread.last_message_at = message.created_at
        thread.save(update_fields=["last_message_at"])
        ThreadParticipant.objects.filter(thread=thread, user=request.user).update(
            last_read_at=message.created_at
        )
    elif thread.last_message_at is None:
        thread.last_message_at = timezone.now()
        thread.save(update_fields=["last_message_at"])

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
    response={201: DirectMessageSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def create_thread_message(request, thread_id: int, payload: DirectMessageCreateInput):
    """Send one direct message in the specified thread."""

    thread = _get_thread_for_request(request, thread_id)
    normalized_body, errors = _validated_message_body(payload.body)
    if errors is not None:
        return Status(400, errors)
    message = DirectMessage.objects.create(
        thread=thread,
        sender=request.user,
        body=normalized_body,
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
