"""Serializers for direct-message threads and messages."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from typing import cast

from messaging.models import (
    DirectMessage,
    Thread,
    ThreadParticipant,
    users_share_project,
)


class ThreadCounterpartSerializer(serializers.Serializer):
    """Serialize the other user visible in a 1:1 thread."""

    id = serializers.IntegerField()
    username = serializers.CharField()
    display_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)
    avatar_thumbnail_url = serializers.CharField(allow_null=True)


class DirectMessageSerializer(serializers.ModelSerializer):
    """Serialize one direct message within a thread."""

    sender_username = serializers.CharField(source="sender.username", read_only=True)
    sender_display_name = serializers.SerializerMethodField()

    class Meta:
        model = DirectMessage
        fields = [
            "id",
            "thread",
            "sender",
            "sender_username",
            "sender_display_name",
            "body",
            "created_at",
            "edited_at",
        ]
        read_only_fields = fields

    def get_sender_display_name(self, obj: DirectMessage) -> str:
        """Return the sender's display label for message lists."""

        return obj.sender.display_name or obj.sender.username


class ThreadSerializer(serializers.ModelSerializer):
    """Serialize thread summaries for the current participant."""

    counterpart = serializers.SerializerMethodField()
    has_unread = serializers.SerializerMethodField()
    last_message_preview = serializers.SerializerMethodField()
    last_read_at = serializers.SerializerMethodField()

    class Meta:
        model = Thread
        fields = [
            "id",
            "counterpart",
            "has_unread",
            "last_message_preview",
            "last_message_at",
            "last_read_at",
            "created_at",
        ]
        read_only_fields = fields

    def _current_user_id(self) -> int:
        request = self.context["request"]
        return int(request.user.pk)

    def _participant_state(self, obj: Thread) -> ThreadParticipant | None:
        prefetched_state = getattr(obj, "current_participant_states", None)
        if prefetched_state:
            return prefetched_state[0]
        return obj.participant_states.filter(user_id=self._current_user_id()).first()

    def _messages(self, obj: Thread) -> list[DirectMessage]:
        prefetched_messages = getattr(obj, "prefetched_messages", None)
        if prefetched_messages is not None:
            return list(prefetched_messages)
        return list(obj.messages.select_related("sender").order_by("-created_at"))

    def get_counterpart(self, obj: Thread) -> dict[str, object] | None:
        """Return the other participant shown in thread lists."""

        current_user_id = self._current_user_id()
        counterpart = next(
            (
                participant
                for participant in obj.participants.all()
                if participant.pk != current_user_id
            ),
            None,
        )
        if counterpart is None:
            return None
        return {
            "id": int(counterpart.pk),
            "username": counterpart.username,
            "display_name": counterpart.display_name or counterpart.username,
            "avatar_url": counterpart.avatar_url,
            "avatar_thumbnail_url": counterpart.avatar_thumbnail_url,
        }

    def get_has_unread(self, obj: Thread) -> bool:
        """Return whether the current user has unread incoming messages."""

        participant_state = self._participant_state(obj)
        last_read_at = participant_state.last_read_at if participant_state else None
        current_user_id = self._current_user_id()
        return any(
            message.sender_id != current_user_id
            and (last_read_at is None or message.created_at > last_read_at)
            for message in self._messages(obj)
        )

    def get_last_message_preview(self, obj: Thread) -> str:
        """Return a compact preview of the latest message body."""

        messages = self._messages(obj)
        if not messages:
            return ""
        return messages[0].body[:140]

    def get_last_read_at(self, obj: Thread):
        """Return the current participant's last-read timestamp."""

        participant_state = self._participant_state(obj)
        return participant_state.last_read_at if participant_state else None


class ThreadCreateSerializer(serializers.Serializer):
    """Validate the recipient and optional opening message for a new thread."""

    recipient_user_id = serializers.IntegerField()
    opening_message = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=True
    )

    def validate_recipient_user_id(self, value: int) -> int:
        """Require a real user distinct from the current sender."""

        request = self.context["request"]
        if value == request.user.pk:
            raise serializers.ValidationError("You cannot message yourself.")

        user_model = get_user_model()
        if not user_model.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Recipient not found.")
        return value

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        """Require both users to share at least one project membership."""

        request = self.context["request"]
        recipient_user_id = cast(int, attrs["recipient_user_id"])
        if not users_share_project(int(request.user.pk), recipient_user_id):
            raise serializers.ValidationError(
                {
                    "recipient_user_id": "You can only message users who share a project with you."
                }
            )
        return attrs

    def create(self, validated_data: dict[str, object]) -> Thread:
        """Find or create the 1:1 thread and optionally add the opening message."""

        request = self.context["request"]
        recipient_user_id = cast(int, validated_data["recipient_user_id"])
        opening_message = str(validated_data.get("opening_message", "")).strip()

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
            ThreadParticipant.objects.filter(
                thread=thread,
                user=request.user,
            ).update(last_read_at=message.created_at)
        elif thread.last_message_at is None:
            thread.last_message_at = timezone.now()
            thread.save(update_fields=["last_message_at"])

        return thread


class DirectMessageCreateSerializer(serializers.Serializer):
    """Validate a new outbound direct message body."""

    body = serializers.CharField(trim_whitespace=True)
