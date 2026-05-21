from typing import Any, cast
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

import projects.ninja_api
from projects.models import Project, ProjectMembership, ProjectRole
from users.models import MembershipInvitation


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed API test assertions."""
    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _create_user(user_model: type[Any], **kwargs: object):
    return cast(Any, user_model.objects).create_user(**kwargs)


class ProjectInvitationNinjaApiTests(APITestCase):
    """Exercise project invitation Ninja API endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.owner_project = Project.objects.create(
            name="Owner Project",
            topic_description="Platform engineering",
        )
        self.admin_membership = ProjectMembership.objects.create(
            user=self.owner,
            project=self.owner_project,
            role=ProjectRole.ADMIN,
        )
        self.client.login(username="owner", password="testpass123")

    def test_list_invitations(self):
        MembershipInvitation.objects.create(
            project=self.owner_project,
            email="test1@example.com",
            role=ProjectRole.MEMBER,
        )
        response = self.client.get(
            reverse(
                "ninja-api:list_invitations",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["email"], "test1@example.com")

    @patch("projects.ninja_invitations_api._send_membership_invitation_email")
    def test_create_invitation(self, mock_send_email):
        response = self.client.post(
            reverse(
                "ninja-api:create_invitation",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"email": "test2@example.com", "role": ProjectRole.MEMBER},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["email"], "test2@example.com")
        self.assertEqual(
            MembershipInvitation.objects.filter(project=self.owner_project).count(), 1
        )
        mock_send_email.assert_called_once()

    def test_revoke_invitation(self):
        invitation = MembershipInvitation.objects.create(
            project=self.owner_project,
            email="test3@example.com",
            role=ProjectRole.MEMBER,
        )
        response = self.client.delete(
            reverse(
                "ninja-api:revoke_invitation",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "invitation_id": _require_pk(invitation),
                },
            )
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        invitation.refresh_from_db()
        self.assertIsNotNone(invitation.revoked_at)
