from typing import Any, cast

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from projects.models import Project, ProjectMembership, ProjectRole


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed API test assertions."""
    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)

def _create_user(user_model: type[Any], **kwargs: object):
    return cast(Any, user_model.objects).create_user(**kwargs)

class ProjectMembershipNinjaApiTests(APITestCase):
    """Exercise project membership Ninja API endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.member_user = _create_user(user_model, username="member", password="testpass123")
        self.owner_project = Project.objects.create(
            name="Owner Project",
            topic_description="Platform engineering",
        )
        self.admin_membership = ProjectMembership.objects.create(
            user=self.owner,
            project=self.owner_project,
            role=ProjectRole.ADMIN,
        )
        self.member_membership = ProjectMembership.objects.create(
            user=self.member_user,
            project=self.owner_project,
            role=ProjectRole.MEMBER,
        )
        self.client.login(username="owner", password="testpass123")

    def test_list_memberships(self):
        response = self.client.get(
            reverse(
                "ninja-api:list_memberships",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 2 memberships
        self.assertEqual(len(response.json()), 2)

    def test_update_membership_role(self):
        response = self.client.patch(
            reverse(
                "ninja-api:update_membership",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "membership_id": _require_pk(self.member_membership),
                },
            ),
            {"role": ProjectRole.ADMIN},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member_membership.refresh_from_db()
        self.assertEqual(self.member_membership.role, ProjectRole.ADMIN)
        
    def test_update_role_fails_for_last_admin(self):
        response = self.client.patch(
            reverse(
                "ninja-api:update_membership",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "membership_id": _require_pk(self.admin_membership),
                },
            ),
            {"role": ProjectRole.MEMBER},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_membership(self):
        response = self.client.delete(
            reverse(
                "ninja-api:delete_membership",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "membership_id": _require_pk(self.member_membership),
                },
            )
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(ProjectMembership.objects.filter(project=self.owner_project).count(), 1)
