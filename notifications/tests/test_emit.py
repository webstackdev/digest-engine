"""Tests for the notification emit helper."""

from __future__ import annotations

from typing import Any, cast

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from notifications.emit import notify, notify_project_admins
from notifications.models import Notification, NotificationLevel
from projects.models import Project, ProjectMembership, ProjectRole


def _create_user(user_model: type[Any], **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


class NotificationEmitTests(TestCase):
    """Verify notification creation respects the messaging feature flag."""

    def setUp(self):
        user_model = get_user_model()
        self.user = _create_user(user_model, username="owner", password="testpass123")
        self.project = Project.objects.create(
            name="Owner Project",
            topic_description="Platform engineering",
        )

    @override_settings(MESSAGING_ENABLED=False)
    def test_notify_is_noop_when_messaging_disabled(self):
        result = notify(
            self.user,
            level=NotificationLevel.INFO,
            body="Should not persist",
        )

        self.assertIsNone(result)
        self.assertEqual(Notification.objects.count(), 0)

    @override_settings(MESSAGING_ENABLED=True)
    def test_notify_persists_notification_when_messaging_enabled(self):
        result = notify(
            self.user,
            level=NotificationLevel.SUCCESS,
            body="Draft generation completed",
            link_path="/messages",
            project=self.project,
            metadata={"draft_id": 42},
        )

        self.assertIsNotNone(result)
        notification = Notification.objects.get()
        self.assertEqual(notification.user, self.user)
        self.assertEqual(notification.project, self.project)
        self.assertEqual(notification.level, NotificationLevel.SUCCESS)
        self.assertEqual(notification.link_path, "/messages")
        self.assertEqual(notification.metadata, {"draft_id": 42})

    @override_settings(MESSAGING_ENABLED=True)
    def test_notify_project_admins_notifies_each_project_admin(self):
        user_model = get_user_model()
        second_admin = _create_user(
            user_model,
            username="second-admin",
            password="testpass123",
        )
        ProjectMembership.objects.create(
            user=self.user,
            project=self.project,
            role=ProjectRole.ADMIN,
        )
        ProjectMembership.objects.create(
            user=second_admin,
            project=self.project,
            role=ProjectRole.ADMIN,
        )

        created_count = notify_project_admins(
            self.project,
            level=NotificationLevel.INFO,
            body="Draft generation completed",
            link_path="/drafts/42",
            metadata={"draft_id": 42},
        )

        self.assertEqual(created_count, 2)
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(
            set(Notification.objects.values_list("user__username", flat=True)),
            {"owner", "second-admin"},
        )
