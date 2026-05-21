from __future__ import annotations

from typing import Any, cast

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from ingestion.models import IngestionRun, RunStatus
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


class IngestionRunNinjaApiTests(APITestCase):
    """Exercise project-scoped Ninja ingestion-run endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.reader = _create_user(
            user_model,
            username="reader",
            password="testpass123",
        )
        self.other_user = _create_user(
            user_model,
            username="other",
            password="testpass123",
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
            user=self.reader,
            project=self.owner_project,
            role=ProjectRole.READER,
        )
        ProjectMembership.objects.create(
            user=self.other_user,
            project=self.other_project,
            role=ProjectRole.ADMIN,
        )

        self.owner_run = IngestionRun.objects.create(
            project=self.owner_project,
            plugin_name="rss",
            status=RunStatus.SUCCESS,
            items_fetched=5,
            items_ingested=4,
        )
        self.other_run = IngestionRun.objects.create(
            project=self.other_project,
            plugin_name="reddit",
            status=RunStatus.FAILED,
            items_fetched=2,
            items_ingested=0,
            error_message="Boom",
        )

        _typed_client(self.client).force_login(self.owner)

    def test_list_ingestion_runs_is_project_scoped(self):
        response = self.client.get(
            reverse(
                "ninja-api:list_ingestion_runs",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(self.owner_run))

    def test_create_ingestion_run_uses_project_from_url(self):
        response = self.client.post(
            reverse(
                "ninja-api:create_ingestion_run",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "plugin_name": "bluesky",
                "status": RunStatus.RUNNING,
                "items_fetched": 0,
                "items_ingested": 0,
                "error_message": "",
                "project": _require_pk(self.other_project),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_run = IngestionRun.objects.get(plugin_name="bluesky")
        self.assertEqual(created_run.project, self.owner_project)
        self.assertEqual(created_run.status, RunStatus.RUNNING)

    def test_create_ingestion_run_rejects_invalid_status(self):
        response = self.client.post(
            reverse(
                "ninja-api:create_ingestion_run",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "plugin_name": "bluesky",
                "status": "invalid-status",
                "items_fetched": 0,
                "items_ingested": 0,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json()["status"][0],
            "Value 'invalid-status' is not a valid choice.",
        )

    def test_reader_can_list_but_cannot_create(self):
        _typed_client(self.client).force_login(self.reader)

        list_response = self.client.get(
            reverse(
                "ninja-api:list_ingestion_runs",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)

        create_response = self.client.post(
            reverse(
                "ninja-api:create_ingestion_run",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "plugin_name": "mastodon",
                "status": RunStatus.RUNNING,
                "items_fetched": 1,
                "items_ingested": 0,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_and_delete_ingestion_run(self):
        update_response = self.client.patch(
            reverse(
                "ninja-api:update_ingestion_run",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "run_id": _require_pk(self.owner_run),
                },
            ),
            {
                "status": RunStatus.FAILED,
                "items_fetched": 7,
                "items_ingested": 3,
                "error_message": "Partial failure",
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.owner_run.refresh_from_db()
        self.assertEqual(self.owner_run.status, RunStatus.FAILED)
        self.assertEqual(self.owner_run.items_fetched, 7)
        self.assertEqual(self.owner_run.error_message, "Partial failure")

        delete_response = self.client.delete(
            reverse(
                "ninja-api:delete_ingestion_run",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "run_id": _require_pk(self.owner_run),
                },
            )
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            IngestionRun.objects.filter(pk=_require_pk(self.owner_run)).exists()
        )
