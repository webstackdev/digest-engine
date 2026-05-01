from typing import Any, cast

from django.core import mail
from django.db.models import Model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from projects.models import Project, ProjectMembership, ProjectRole
from users.models import MembershipInvitation


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed invitation test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _typed_client(client: object) -> APIClient:
    """Cast the DRF test client so Pylance sees APIClient helpers."""

    return cast(APIClient, client)


def _create_user(user_model: type[Any], **kwargs: object):
    """Create a user via the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_BASE_URL="http://localhost:3000",
)
class ProjectMembershipAndInvitationApiTests(APITestCase):
    def setUp(self):
        user_model = self.get_user_model()
        self.admin_user = _create_user(
            user_model,
            username="project-admin",
            email="admin@example.com",
            password="testpass123",
            display_name="Project Admin",
        )
        self.second_admin = _create_user(
            user_model,
            username="second-admin",
            email="second-admin@example.com",
            password="testpass123",
        )
        self.member_user = _create_user(
            user_model,
            username="project-member",
            email="member@example.com",
            password="testpass123",
        )
        self.reader_user = _create_user(
            user_model,
            username="project-reader",
            email="reader@example.com",
            password="testpass123",
        )
        self.invited_user = _create_user(
            user_model,
            username="invited-user",
            email="invitee@example.com",
            password="testpass123",
        )

        self.project = Project.objects.create(
            name="Membership Project",
            topic_description="Platform engineering",
        )
        self.admin_membership = ProjectMembership.objects.create(
            user=self.admin_user,
            project=self.project,
            role=ProjectRole.ADMIN,
        )
        self.second_admin_membership = ProjectMembership.objects.create(
            user=self.second_admin,
            project=self.project,
            role=ProjectRole.ADMIN,
        )
        self.member_membership = ProjectMembership.objects.create(
            user=self.member_user,
            project=self.project,
            role=ProjectRole.MEMBER,
        )
        self.reader_membership = ProjectMembership.objects.create(
            user=self.reader_user,
            project=self.project,
            role=ProjectRole.READER,
        )

    @staticmethod
    def get_user_model():
        from django.contrib.auth import get_user_model

        return get_user_model()

    def test_project_create_assigns_creator_as_admin_membership(self):
        creator = _create_user(
            self.get_user_model(),
            username="creator",
            email="creator@example.com",
            password="testpass123",
        )
        _typed_client(self.client).force_authenticate(creator)

        response = self.client.post(
            reverse("v1:project-list"),
            {
                "name": "Creator Project",
                "topic_description": "Creator-owned project",
                "content_retention_days": 90,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project = Project.objects.get(name="Creator Project")
        membership = ProjectMembership.objects.get(project=project, user=creator)
        self.assertEqual(membership.role, ProjectRole.ADMIN)
        self.assertEqual(response.json()["user_role"], ProjectRole.ADMIN)

    def test_project_admin_can_list_update_and_remove_memberships(self):
        _typed_client(self.client).force_authenticate(self.admin_user)

        list_response = self.client.get(
            reverse(
                "v1:project-membership-list",
                kwargs={"project_id": _require_pk(self.project)},
            )
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.json()), 4)

        update_response = self.client.patch(
            reverse(
                "v1:project-membership-detail",
                kwargs={
                    "project_id": _require_pk(self.project),
                    "pk": _require_pk(self.member_membership),
                },
            ),
            {"role": ProjectRole.READER},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.member_membership.refresh_from_db()
        self.assertEqual(self.member_membership.role, ProjectRole.READER)

        delete_response = self.client.delete(
            reverse(
                "v1:project-membership-detail",
                kwargs={
                    "project_id": _require_pk(self.project),
                    "pk": _require_pk(self.reader_membership),
                },
            )
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            ProjectMembership.objects.filter(
                pk=_require_pk(self.reader_membership)
            ).exists()
        )

    def test_last_admin_cannot_be_demoted_or_removed(self):
        self.second_admin_membership.delete()
        _typed_client(self.client).force_authenticate(self.admin_user)

        demote_response = self.client.patch(
            reverse(
                "v1:project-membership-detail",
                kwargs={
                    "project_id": _require_pk(self.project),
                    "pk": _require_pk(self.admin_membership),
                },
            ),
            {"role": ProjectRole.MEMBER},
            format="json",
        )
        self.assertEqual(demote_response.status_code, status.HTTP_400_BAD_REQUEST)

        delete_response = self.client.delete(
            reverse(
                "v1:project-membership-detail",
                kwargs={
                    "project_id": _require_pk(self.project),
                    "pk": _require_pk(self.admin_membership),
                },
            )
        )
        self.assertEqual(delete_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_project_admin_can_create_and_revoke_invitation(self):
        _typed_client(self.client).force_authenticate(self.admin_user)

        create_response = self.client.post(
            reverse(
                "v1:project-invitation-list",
                kwargs={"project_id": _require_pk(self.project)},
            ),
            {"email": "invitee@example.com", "role": ProjectRole.MEMBER},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        invitation = MembershipInvitation.objects.get(project=self.project)
        self.assertEqual(invitation.invited_by, self.admin_user)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(invitation.token, str(mail.outbox[0].body))

        revoke_response = self.client.delete(
            reverse(
                "v1:project-invitation-detail",
                kwargs={
                    "project_id": _require_pk(self.project),
                    "pk": _require_pk(invitation),
                },
            )
        )
        self.assertEqual(revoke_response.status_code, status.HTTP_204_NO_CONTENT)
        invitation.refresh_from_db()
        self.assertIsNotNone(invitation.revoked_at)

    def test_invited_user_can_view_and_accept_invitation_token(self):
        invitation = MembershipInvitation.objects.create(
            project=self.project,
            email=self.invited_user.email,
            role=ProjectRole.READER,
            invited_by=self.admin_user,
        )

        public_response = self.client.get(
            reverse(
                "membership-invitation-token",
                kwargs={"token": invitation.token},
            )
        )
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.json()["project_name"], self.project.name)

        _typed_client(self.client).force_authenticate(self.invited_user)
        accept_response = self.client.post(
            reverse(
                "membership-invitation-token",
                kwargs={"token": invitation.token},
            ),
            format="json",
        )
        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)

        invitation.refresh_from_db()
        membership = ProjectMembership.objects.get(
            project=self.project,
            user=self.invited_user,
        )
        self.assertEqual(membership.role, ProjectRole.READER)
        self.assertIsNotNone(invitation.accepted_at)

    def test_accept_requires_matching_email(self):
        invitation = MembershipInvitation.objects.create(
            project=self.project,
            email="expected@example.com",
            role=ProjectRole.MEMBER,
            invited_by=self.admin_user,
        )
        _typed_client(self.client).force_authenticate(self.member_user)

        response = self.client.post(
            reverse(
                "membership-invitation-token",
                kwargs={"token": invitation.token},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
