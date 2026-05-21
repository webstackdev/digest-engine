"""Tests for the Django Ninja notifications API surface."""

from __future__ import annotations

from typing import Any, cast

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

import pytest

from notifications.models import Notification, NotificationLevel
from projects.models import Project

pytestmark = pytest.mark.django_db


def _response(value: object) -> Any:
    """Return a typed response object for assertions."""

    return cast(Any, value)


def test_ninja_notification_list_returns_only_current_user_notifications():
    user_model = get_user_model()
    owner = cast(Any, user_model.objects).create_user(
        username="owner", password="testpass123"
    )
    other_user = cast(Any, user_model.objects).create_user(
        username="other", password="testpass123"
    )
    project = Project.objects.create(
        name="Owner Project", topic_description="Platform engineering"
    )
    Notification.objects.create(
        user=owner,
        project=project,
        level=NotificationLevel.INFO,
        body="Already read",
        read_at=timezone.now(),
    )
    Notification.objects.create(
        user=owner,
        project=project,
        level=NotificationLevel.ERROR,
        body="Needs attention",
    )
    Notification.objects.create(
        user=other_user,
        level=NotificationLevel.SUCCESS,
        body="Other user notification",
    )

    client = APIClient()
    client.force_login(owner)
    response = _response(client.get("/api/ninja/v1/notifications/"))

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["body"] == "Needs attention"
    assert payload[1]["body"] == "Already read"


def test_ninja_notification_list_can_filter_to_unread_notifications():
    user_model = get_user_model()
    owner = cast(Any, user_model.objects).create_user(
        username="owner2", password="testpass123"
    )
    project = Project.objects.create(
        name="Unread Project", topic_description="Platform engineering"
    )
    Notification.objects.create(
        user=owner,
        project=project,
        level=NotificationLevel.INFO,
        body="Already read",
        read_at=timezone.now(),
    )
    Notification.objects.create(
        user=owner,
        project=project,
        level=NotificationLevel.ERROR,
        body="Needs attention",
    )

    client = APIClient()
    client.force_login(owner)
    response = _response(client.get("/api/ninja/v1/notifications/", {"unread": "true"}))

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["body"] == "Needs attention"
    assert payload[0]["is_read"] is False


def test_ninja_notification_read_action_sets_read_at():
    user_model = get_user_model()
    owner = cast(Any, user_model.objects).create_user(
        username="owner3", password="testpass123"
    )
    notification = Notification.objects.create(
        user=owner,
        level=NotificationLevel.ERROR,
        body="Needs attention",
    )

    client = APIClient()
    client.force_login(owner)
    response = _response(
        client.post(f"/api/ninja/v1/notifications/{notification.pk}/read/")
    )

    assert response.status_code == status.HTTP_200_OK
    notification.refresh_from_db()
    assert notification.read_at is not None
    assert response.json()["is_read"] is True


def test_ninja_notification_read_all_marks_only_current_users_unread_rows():
    user_model = get_user_model()
    owner = cast(Any, user_model.objects).create_user(
        username="owner4", password="testpass123"
    )
    other_user = cast(Any, user_model.objects).create_user(
        username="other4", password="testpass123"
    )
    unread_notification = Notification.objects.create(
        user=owner,
        level=NotificationLevel.ERROR,
        body="Needs attention",
    )
    Notification.objects.create(
        user=other_user,
        level=NotificationLevel.SUCCESS,
        body="Other user notification",
    )

    client = APIClient()
    client.force_login(owner)
    response = _response(client.post("/api/ninja/v1/notifications/read-all/"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["updated_count"] == 1
    unread_notification.refresh_from_db()
    assert unread_notification.read_at is not None


def test_ninja_notification_destroy_deletes_owned_notification():
    user_model = get_user_model()
    owner = cast(Any, user_model.objects).create_user(
        username="owner5", password="testpass123"
    )
    notification = Notification.objects.create(
        user=owner,
        level=NotificationLevel.ERROR,
        body="Needs attention",
    )

    client = APIClient()
    client.force_login(owner)
    response = _response(
        client.delete(f"/api/ninja/v1/notifications/{notification.pk}/")
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert Notification.objects.filter(pk=notification.pk).exists() is False
