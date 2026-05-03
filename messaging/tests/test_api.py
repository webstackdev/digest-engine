"""API tests for direct-message threads and messages."""

from __future__ import annotations

from typing import Any, cast

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from messaging.models import DirectMessage, Thread, ThreadParticipant
from projects.models import Project, ProjectMembership, ProjectRole


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _typed_client(client: object) -> APIClient:
    """Cast the DRF client so type checkers see authentication helpers."""

    return cast(APIClient, client)


def _create_user(user_model: type[Any], **kwargs: object):
    """Create one user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


class MessagingApiTests(APITestCase):
    """Exercise the direct-message thread endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.alice = _create_user(user_model, username="alice", password="testpass123")
        self.bob = _create_user(user_model, username="bob", password="testpass123")
        self.carol = _create_user(user_model, username="carol", password="testpass123")
        self.shared_project = Project.objects.create(
            name="Shared Project",
            topic_description="Delivery",
        )
        self.private_project = Project.objects.create(
            name="Private Project",
            topic_description="Security",
        )
        ProjectMembership.objects.create(
            user=self.alice,
            project=self.shared_project,
            role=ProjectRole.ADMIN,
        )
        ProjectMembership.objects.create(
            user=self.bob,
            project=self.shared_project,
            role=ProjectRole.MEMBER,
        )
        ProjectMembership.objects.create(
            user=self.carol,
            project=self.private_project,
            role=ProjectRole.ADMIN,
        )
        _typed_client(self.client).force_authenticate(self.alice)

    def _create_thread(self) -> Thread:
        thread = Thread.objects.create()
        ThreadParticipant.objects.create(thread=thread, user=self.alice)
        ThreadParticipant.objects.create(thread=thread, user=self.bob)
        return thread

    def test_thread_list_is_scoped_to_the_current_participant(self):
        visible_thread = self._create_thread()
        hidden_thread = Thread.objects.create()
        ThreadParticipant.objects.create(thread=hidden_thread, user=self.bob)
        ThreadParticipant.objects.create(thread=hidden_thread, user=self.carol)
        DirectMessage.objects.create(
            thread=visible_thread,
            sender=self.bob,
            body="Draft is ready.",
        )

        response = self.client.get(reverse("v1:messaging-thread-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        payload = response.json()[0]
        self.assertEqual(payload["id"], _require_pk(visible_thread))
        self.assertEqual(payload["counterpart"]["username"], "bob")
        self.assertEqual(payload["last_message_preview"], "Draft is ready.")
        self.assertTrue(payload["has_unread"])

    def test_thread_create_requires_a_shared_project(self):
        response = self.client.post(
            reverse("v1:messaging-thread-list"),
            {"recipient_user_id": _require_pk(self.carol)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["errors"][0]["attr"], "recipient_user_id")

    def test_thread_create_creates_a_thread_and_optional_opening_message(self):
        response = self.client.post(
            reverse("v1:messaging-thread-list"),
            {
                "recipient_user_id": _require_pk(self.bob),
                "opening_message": "Want to review this draft together?",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        thread = Thread.objects.get(pk=response.json()["id"])
        self.assertEqual(thread.participants.count(), 2)
        self.assertEqual(thread.messages.count(), 1)
        self.assertEqual(
            thread.messages.get().body, "Want to review this draft together?"
        )
        self.assertEqual(response.json()["counterpart"]["username"], "bob")

    def test_messages_action_lists_and_creates_messages_for_a_participant(self):
        thread = self._create_thread()
        DirectMessage.objects.create(
            thread=thread, sender=self.bob, body="Initial note"
        )

        list_response = self.client.get(
            reverse("v1:messaging-thread-messages", kwargs={"pk": _require_pk(thread)})
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.json()), 1)
        self.assertEqual(list_response.json()[0]["sender_username"], "bob")

        create_response = self.client.post(
            reverse("v1:messaging-thread-messages", kwargs={"pk": _require_pk(thread)}),
            {"body": "Replying now."},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.json()["sender_username"], "alice")
        thread.refresh_from_db()
        self.assertIsNotNone(thread.last_message_at)

    def test_read_action_updates_the_current_users_last_read_cursor(self):
        thread = self._create_thread()
        message = DirectMessage.objects.create(
            thread=thread,
            sender=self.bob,
            body="Unread message",
        )
        thread.last_message_at = message.created_at
        thread.save(update_fields=["last_message_at"])

        response = self.client.post(
            reverse("v1:messaging-thread-read", kwargs={"pk": _require_pk(thread)}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        participant_state = ThreadParticipant.objects.get(
            thread=thread, user=self.alice
        )
        self.assertEqual(response.json()["thread_id"], _require_pk(thread))
        self.assertIsNotNone(participant_state.last_read_at)
