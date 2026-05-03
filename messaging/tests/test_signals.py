"""Signal tests for websocket fan-out of new direct messages."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from messaging.models import DirectMessage, Thread, ThreadParticipant
from projects.models import Project, ProjectMembership, ProjectRole


@override_settings(MESSAGING_ENABLED=True)
class DirectMessageSignalTests(TestCase):
    """Verify newly created direct messages emit the expected channel-layer event."""

    def setUp(self) -> None:
        user_model = get_user_model()
        self.sender = user_model.objects.create_user(
            username="signal-sender",
            password="testpass123",
        )
        self.recipient = user_model.objects.create_user(
            username="signal-recipient",
            password="testpass123",
        )
        self.project = Project.objects.create(
            name="Signal Project",
            topic_description="Realtime",
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.sender,
            role=ProjectRole.ADMIN,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.recipient,
            role=ProjectRole.MEMBER,
        )
        self.thread = Thread.objects.create()
        ThreadParticipant.objects.create(thread=self.thread, user=self.sender)
        ThreadParticipant.objects.create(thread=self.thread, user=self.recipient)

    def test_direct_message_create_broadcasts_to_thread_group(self) -> None:
        send_mock = Mock()
        fake_channel_layer = SimpleNamespace(group_send=object())

        with (
            patch(
                "messaging.signals.get_channel_layer",
                return_value=fake_channel_layer,
            ),
            patch("messaging.signals.async_to_sync", return_value=send_mock),
        ):
            message = DirectMessage.objects.create(
                thread=self.thread,
                sender=self.sender,
                body="Draft is ready for review.",
            )

        send_mock.assert_called_once()
        group_name, event = send_mock.call_args.args
        self.assertEqual(group_name, f"thread.{self.thread.pk}")
        self.assertEqual(event["type"], "message.created")
        self.assertEqual(event["message"]["id"], int(message.pk))
        self.assertEqual(event["message"]["thread"], int(self.thread.pk))
        self.assertEqual(event["message"]["body"], "Draft is ready for review.")
