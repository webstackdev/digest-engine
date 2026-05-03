"""Signal tests for websocket fan-out of new notifications."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from notifications.models import Notification, NotificationLevel
from projects.models import Project


@override_settings(MESSAGING_ENABLED=True)
class NotificationSignalTests(TestCase):
    """Verify newly created notifications emit the expected channel-layer event."""

    def setUp(self) -> None:
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="signal-user",
            password="testpass123",
        )
        self.project = Project.objects.create(
            name="Signal Project",
            topic_description="Realtime",
        )

    def test_notification_create_broadcasts_to_user_group(self) -> None:
        send_mock = Mock()
        fake_channel_layer = SimpleNamespace(group_send=object())

        with (
            patch(
                "notifications.signals.get_channel_layer",
                return_value=fake_channel_layer,
            ),
            patch("notifications.signals.async_to_sync", return_value=send_mock),
        ):
            notification = Notification.objects.create(
                user=self.user,
                project=self.project,
                level=NotificationLevel.SUCCESS,
                body="Draft ready",
                link_path="/drafts/42",
                metadata={"draft_id": 42},
            )

        send_mock.assert_called_once()
        group_name, event = send_mock.call_args.args
        self.assertEqual(group_name, f"notif.{self.user.pk}")
        self.assertEqual(event["type"], "notification.created")
        self.assertEqual(event["notification"]["id"], int(notification.pk))
        self.assertEqual(event["notification"]["body"], "Draft ready")
        self.assertEqual(event["notification"]["link_path"], "/drafts/42")
