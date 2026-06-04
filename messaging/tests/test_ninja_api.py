"""Tests for the Django Ninja messaging API surface."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any, cast

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from messaging.models import DirectMessage, Thread, ThreadParticipant
from projects.models import Project, ProjectMembership, ProjectRole

pytestmark = pytest.mark.django_db


def _response(value: object) -> Any:
    """Return a typed response object for assertions."""

    return cast(Any, value)


def _create_user(**kwargs: object):
    """Create one user through the custom manager with a typed escape hatch."""

    user_model = get_user_model()
    return cast(Any, user_model.objects).create_user(**kwargs)


def _create_fixture_users_and_projects():
    """Build a shared messaging fixture."""

    alice = _create_user(username="alice-ninja", password="testpass123")
    bob = _create_user(username="bob-ninja", password="testpass123")
    carol = _create_user(username="carol-ninja", password="testpass123")
    shared_project = Project.objects.create(
        name="Shared Project", topic_description="Delivery"
    )
    private_project = Project.objects.create(
        name="Private Project", topic_description="Security"
    )
    ProjectMembership.objects.create(
        user=alice, project=shared_project, role=ProjectRole.ADMIN
    )
    ProjectMembership.objects.create(
        user=bob, project=shared_project, role=ProjectRole.MEMBER
    )
    ProjectMembership.objects.create(
        user=carol, project=private_project, role=ProjectRole.ADMIN
    )
    return alice, bob, carol


def _create_thread(alice, bob) -> Thread:
    """Create one direct-message thread between two fixture users."""

    thread = Thread.objects.create()
    ThreadParticipant.objects.create(thread=thread, user=alice)
    ThreadParticipant.objects.create(thread=thread, user=bob)
    return thread


def test_ninja_thread_list_is_scoped_to_the_current_participant():
    alice, bob, carol = _create_fixture_users_and_projects()
    visible_thread = _create_thread(alice, bob)
    hidden_thread = Thread.objects.create()
    ThreadParticipant.objects.create(thread=hidden_thread, user=bob)
    ThreadParticipant.objects.create(thread=hidden_thread, user=carol)
    DirectMessage.objects.create(
        thread=visible_thread, sender=bob, body="Draft is ready."
    )

    client = Client()
    client.force_login(alice)
    response = _response(client.get("/api/v1/messaging/threads/"))

    assert response.status_code == HTTPStatus.OK
    assert len(response.json()) == 1
    payload = response.json()[0]
    assert payload["id"] == int(visible_thread.pk)
    assert payload["counterpart"]["username"] == "bob-ninja"
    assert payload["last_message_preview"] == "Draft is ready."
    assert payload["has_unread"] is True


def test_ninja_thread_create_requires_a_shared_project():
    alice, _, carol = _create_fixture_users_and_projects()

    client = Client()
    client.force_login(alice)
    response = _response(
        client.post(
            "/api/v1/messaging/threads/",
            {"recipient_user_id": int(carol.pk)},
            content_type="application/json",
        )
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert (
        response.json()["recipient_user_id"][0]
        == "You can only message users who share a project with you."
    )


def test_ninja_thread_create_rejects_messaging_yourself():
    alice, _, _ = _create_fixture_users_and_projects()

    client = Client()
    client.force_login(alice)
    response = _response(
        client.post(
            "/api/v1/messaging/threads/",
            {"recipient_user_id": int(alice.pk)},
            content_type="application/json",
        )
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json()["recipient_user_id"][0] == "You cannot message yourself."


def test_ninja_thread_create_creates_a_thread_and_optional_opening_message():
    alice, bob, _ = _create_fixture_users_and_projects()

    client = Client()
    client.force_login(alice)
    response = _response(
        client.post(
            "/api/v1/messaging/threads/",
            {
                "recipient_user_id": int(bob.pk),
                "opening_message": "Want to review this draft together?",
            },
            content_type="application/json",
        )
    )

    assert response.status_code == HTTPStatus.CREATED
    thread = Thread.objects.get(pk=response.json()["id"])
    assert thread.participants.count() == 2
    assert thread.messages.count() == 1
    assert thread.messages.get().body == "Want to review this draft together?"
    assert response.json()["counterpart"]["username"] == "bob-ninja"


def test_ninja_messages_endpoint_lists_and_creates_messages_for_a_participant():
    alice, bob, _ = _create_fixture_users_and_projects()
    thread = _create_thread(alice, bob)
    DirectMessage.objects.create(thread=thread, sender=bob, body="Initial note")

    client = Client()
    client.force_login(alice)
    list_response = _response(
        client.get(f"/api/v1/messaging/threads/{thread.pk}/messages/")
    )

    assert list_response.status_code == HTTPStatus.OK
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["sender_username"] == "bob-ninja"

    create_response = _response(
        client.post(
            f"/api/v1/messaging/threads/{thread.pk}/messages/",
            {"body": "Replying now."},
            content_type="application/json",
        )
    )

    assert create_response.status_code == HTTPStatus.CREATED
    assert create_response.json()["sender_username"] == "alice-ninja"
    thread.refresh_from_db()
    assert thread.last_message_at is not None


def test_ninja_read_action_updates_the_current_users_last_read_cursor():
    alice, bob, _ = _create_fixture_users_and_projects()
    thread = _create_thread(alice, bob)
    message = DirectMessage.objects.create(
        thread=thread, sender=bob, body="Unread message"
    )
    thread.last_message_at = message.created_at
    thread.save(update_fields=["last_message_at"])

    client = Client()
    client.force_login(alice)
    response = _response(
        client.post(
            f"/api/v1/messaging/threads/{thread.pk}/read/",
            content_type="application/json",
        )
    )

    assert response.status_code == HTTPStatus.OK
    participant_state = ThreadParticipant.objects.get(thread=thread, user=alice)
    assert response.json()["thread_id"] == int(thread.pk)
    assert participant_state.last_read_at is not None
