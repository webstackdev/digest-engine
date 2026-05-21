from typing import Any, cast
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from projects.models import Project, ProjectConfig, ProjectMembership, ProjectRole


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed API test assertions."""
    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)

def _create_user(user_model: type[Any], **kwargs: object):
    return cast(Any, user_model.objects).create_user(**kwargs)

class ProjectConfigNinjaApiTests(APITestCase):
    """Exercise project config Ninja API endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.member_user = _create_user(user_model, username="member", password="testpass123")
        self.owner_project = Project.objects.create(
            name="Owner Project",
            topic_description="Platform engineering",
        )
        ProjectMembership.objects.create(
            user=self.owner,
            project=self.owner_project,
            role=ProjectRole.ADMIN,
        )
        ProjectMembership.objects.create(
            user=self.member_user,
            project=self.owner_project,
            role=ProjectRole.MEMBER,
        )
        self.client.login(username="owner", password="testpass123")

    def test_project_config_detail_exposes_multi_signal_authority_weights(self):
        config = ProjectConfig.objects.create(
            project=self.owner_project,
            draft_schedule_cron="0 9 * * *",
        )

        response = self.client.get(
            reverse(
                "ninja-api:get_config",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "config_id": _require_pk(config),
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["draft_schedule_cron"], "0 9 * * *")
        self.assertEqual(response.json()["authority_weight_mention"], 0.2)
        self.assertEqual(response.json()["authority_weight_engagement"], 0.15)
        self.assertEqual(response.json()["authority_weight_cross_newsletter"], 0.2)

    def test_project_config_patch_updates_multi_signal_authority_weights(self):
        config = ProjectConfig.objects.create(project=self.owner_project)

        response = self.client.patch(
            reverse(
                "ninja-api:update_config",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "config_id": _require_pk(config),
                },
            ),
            {
                "draft_schedule_cron": "15 7 * * 1",
                "authority_weight_engagement": 0.25,
                "authority_weight_source_quality": 0.3,
            },
            format="json",
        )

        config.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(config.draft_schedule_cron, "15 7 * * 1")
        self.assertEqual(config.authority_weight_engagement, 0.25)
        self.assertEqual(config.authority_weight_source_quality, 0.3)

    def test_project_config_patch_rejects_invalid_draft_schedule_cron(self):
        config = ProjectConfig.objects.create(project=self.owner_project)

        response = self.client.patch(
            reverse(
                "ninja-api:update_config",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "config_id": _require_pk(config),
                },
            ),
            {"draft_schedule_cron": "not a cron"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Check validation payload format
        json_data = response.json()
        self.assertIn("draft_schedule_cron", json_data)
        self.assertIn("valid 5-part cron expression", json_data["draft_schedule_cron"][0])

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    @patch("core.tasks.recompute_authority_scores")
    @patch("core.tasks.recompute_source_quality")
    def test_project_config_recompute_authority_runs_tasks_immediately(
        self,
        recompute_source_quality_mock,
        recompute_authority_scores_mock,
    ):
        config = ProjectConfig.objects.create(project=self.owner_project)

        response = self.client.post(
            reverse(
                "ninja-api:recompute_authority",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "config_id": _require_pk(config),
                },
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "completed")
        self.assertEqual(response.json()["project_id"], _require_pk(self.owner_project))
        self.assertEqual(response.json()["config_id"], _require_pk(config))
        recompute_source_quality_mock.assert_called_once_with(
            _require_pk(self.owner_project)
        )
        recompute_authority_scores_mock.assert_called_once_with(
            _require_pk(self.owner_project)
        )
        
    def test_members_cannot_update_config(self):
        self.client.login(username="member", password="testpass123")
        config = ProjectConfig.objects.create(project=self.owner_project)
        response = self.client.patch(
            reverse(
                "ninja-api:update_config",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "config_id": _require_pk(config),
                },
            ),
            {"draft_schedule_cron": "15 7 * * 1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
