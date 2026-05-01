from typing import Any, cast

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from newsletters.models import IntakeAllowlist
from projects.models import Project, ProjectMembership, ProjectRole


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


class NewsletterApiTests(APITestCase):
    """Exercise newsletter-owned project API endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.other_user = _create_user(
            user_model, username="other", password="testpass123"
        )
        self.owner_project = Project.objects.create(
            name="Owner Project",
            topic_description="Platform engineering",
        )
        self.other_project = Project.objects.create(
            name="Other Project",
            topic_description="Frontend",
        )
        ProjectMembership.objects.create(
            user=self.owner,
            project=self.owner_project,
            role=ProjectRole.ADMIN,
        )
        ProjectMembership.objects.create(
            user=self.other_user,
            project=self.other_project,
            role=ProjectRole.ADMIN,
        )
        self.owner_intake_allowlist = IntakeAllowlist.objects.create(
            project=self.owner_project,
            sender_email="sender@example.com",
        )
        _typed_client(self.client).force_authenticate(self.owner)

    def test_intake_allowlist_list_is_scoped_to_request_user_project(self):
        other_allowlist = IntakeAllowlist.objects.create(
            project=self.other_project,
            sender_email="other@example.com",
        )

        response = self.client.get(
            reverse(
                "v1:project-intake-allowlist-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(
            response.json()[0]["id"], _require_pk(self.owner_intake_allowlist)
        )
        self.assertFalse(response.json()[0]["is_confirmed"])
        self.assertNotEqual(response.json()[0]["id"], _require_pk(other_allowlist))

    def test_intake_allowlist_create_and_delete_manage_project_senders(self):
        create_response = self.client.post(
            reverse(
                "v1:project-intake-allowlist-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"sender_email": "new-sender@example.com"},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_allowlist = IntakeAllowlist.objects.get(
            project=self.owner_project,
            sender_email="new-sender@example.com",
        )
        self.assertEqual(
            create_response.json()["project"], _require_pk(self.owner_project)
        )
        self.assertFalse(create_response.json()["is_confirmed"])

        delete_response = self.client.delete(
            reverse(
                "v1:project-intake-allowlist-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(created_allowlist),
                },
            )
        )

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            IntakeAllowlist.objects.filter(pk=_require_pk(created_allowlist)).exists()
        )
