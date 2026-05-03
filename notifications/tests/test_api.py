"""API tests for the notifications app."""

from __future__ import annotations

from typing import Any, cast

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from notifications.models import Notification, NotificationLevel
from projects.models import Project


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed API test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _typed_client(client: object) -> APIClient:
    """Cast the DRF test client so Pylance sees APIClient helpers."""

    return cast(APIClient, client)


def _create_user(user_model: type[Any], **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


class NotificationApiTests(APITestCase):
    """Exercise the current-user notification endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.other_user = _create_user(
            user_model,
            username="other",
            password="testpass123",
        )
        self.project = Project.objects.create(
            name="Owner Project",
            topic_description="Platform engineering",
        )
        self.read_notification = Notification.objects.create(
            user=self.owner,
            project=self.project,
            level=NotificationLevel.INFO,
            body="Already read",
            read_at=timezone.now(),
        )
        self.unread_notification = Notification.objects.create(
            user=self.owner,
            project=self.project,
            level=NotificationLevel.ERROR,
            body="Needs attention",
        )
        Notification.objects.create(
            user=self.other_user,
            level=NotificationLevel.SUCCESS,
            body="Other user notification",
        )
        _typed_client(self.client).force_authenticate(self.owner)

    def test_list_returns_only_current_user_notifications(self):
        response = self.client.get(reverse("v1:notification-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(len(payload), 2)
        self.assertEqual(payload[0]["body"], "Needs attention")
        self.assertEqual(payload[1]["body"], "Already read")

    def test_list_can_filter_to_unread_notifications(self):
        response = self.client.get(reverse("v1:notification-list"), {"unread": "true"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["body"], "Needs attention")
        self.assertFalse(payload[0]["is_read"])

    def test_read_action_sets_read_at(self):
        response = self.client.post(
            reverse(
                "v1:notification-read",
                kwargs={"pk": _require_pk(self.unread_notification)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.unread_notification.refresh_from_db()
        self.assertIsNotNone(self.unread_notification.read_at)
        self.assertTrue(response.json()["is_read"])

    def test_read_all_marks_only_current_users_unread_rows(self):
        response = self.client.post(reverse("v1:notification-read-all"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["updated_count"], 1)
        self.unread_notification.refresh_from_db()
        self.assertIsNotNone(self.unread_notification.read_at)

    def test_destroy_deletes_owned_notification(self):
        response = self.client.delete(
            reverse(
                "v1:notification-detail",
                kwargs={"pk": _require_pk(self.unread_notification)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            Notification.objects.filter(
                pk=_require_pk(self.unread_notification)
            ).exists()
        )
