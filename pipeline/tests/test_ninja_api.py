from __future__ import annotations

from typing import Any, cast
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from content.models import Content
from entities.models import Entity
from pipeline.models import (
    ReviewQueue,
    ReviewReason,
    ReviewResolution,
    SkillResult,
    SkillStatus,
)
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


class PipelineNinjaApiTests(APITestCase):
    """Exercise project-scoped Ninja pipeline endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.member = _create_user(
            user_model, username="member", password="testpass123"
        )
        self.reader = _create_user(
            user_model, username="reader", password="testpass123"
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
            user=self.member,
            project=self.owner_project,
            role=ProjectRole.MEMBER,
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
        self.owner_entity = Entity.objects.create(
            project=self.owner_project,
            name="Owner Entity",
            type="individual",
        )
        self.other_entity = Entity.objects.create(
            project=self.other_project,
            name="Other Entity",
            type="vendor",
        )
        self.owner_content = Content.objects.create(
            project=self.owner_project,
            url="https://example.com/owner",
            title="Owner Content",
            author="Owner Author",
            entity=self.owner_entity,
            source_plugin="rss",
            published_date="2026-04-21T00:00:00Z",
            content_text="Owner content text",
        )
        self.other_content = Content.objects.create(
            project=self.other_project,
            url="https://example.com/other",
            title="Other Content",
            author="Other Author",
            entity=self.other_entity,
            source_plugin="rss",
            published_date="2026-04-21T00:00:00Z",
            content_text="Other content text",
        )
        self.owner_skill_result = SkillResult.objects.create(
            project=self.owner_project,
            content=self.owner_content,
            skill_name="summarization",
            status=SkillStatus.COMPLETED,
            result_data={"summary": "Owner summary"},
            error_message="",
            model_used="gpt-test",
            latency_ms=125,
            confidence=0.87,
        )
        self.other_skill_result = SkillResult.objects.create(
            project=self.other_project,
            content=self.other_content,
            skill_name="summarization",
            status=SkillStatus.FAILED,
            result_data=None,
            error_message="boom",
            model_used="gpt-test",
        )
        self.owner_review_item = ReviewQueue.objects.create(
            project=self.owner_project,
            content=self.owner_content,
            reason=ReviewReason.BORDERLINE_RELEVANCE,
            confidence=0.42,
            failed_node="classify",
            failure_detail="Need a human decision.",
            resolved=False,
            resolution="",
        )
        self.other_review_item = ReviewQueue.objects.create(
            project=self.other_project,
            content=self.other_content,
            reason=ReviewReason.RETRY_EXHAUSTED,
            confidence=0.11,
            failed_node="summarize",
            failure_detail="Other project detail.",
            resolved=False,
            resolution="",
        )
        _typed_client(self.client).force_login(self.owner)

    def test_skill_result_routes_cover_list_create_update_and_validation(self):
        list_response = self.client.get(
            reverse(
                "ninja-api:list_skill_results",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        detail_response = self.client.get(
            reverse(
                "ninja-api:get_skill_result",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "skill_result_id": _require_pk(self.owner_skill_result),
                },
            )
        )
        create_response = self.client.post(
            reverse(
                "ninja-api:list_skill_results",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "content": _require_pk(self.owner_content),
                "project": _require_pk(self.other_project),
                "skill_name": "relevance_scoring",
                "status": SkillStatus.RUNNING,
                "result_data": {"queued": True},
                "model_used": "gpt-5.4",
                "superseded_by": _require_pk(self.owner_skill_result),
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.json()), 1)
        self.assertEqual(
            list_response.json()[0]["id"], _require_pk(self.owner_skill_result)
        )
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            detail_response.json()["content"], _require_pk(self.owner_content)
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_id = create_response.json()["id"]
        created_skill_result = SkillResult.objects.get(pk=created_id)
        self.assertEqual(created_skill_result.project, self.owner_project)
        self.assertEqual(created_skill_result.superseded_by, self.owner_skill_result)
        self.assertEqual(
            create_response.json()["invocation_id"],
            str(created_skill_result.invocation_id),
        )

        update_response = self.client.patch(
            reverse(
                "ninja-api:get_skill_result",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "skill_result_id": created_id,
                },
            ),
            {
                "status": SkillStatus.COMPLETED,
                "confidence": 0.91,
                "superseded_by": None,
            },
            format="json",
        )
        invalid_response = self.client.post(
            reverse(
                "ninja-api:list_skill_results",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "content": _require_pk(self.other_content),
                "skill_name": "summarization",
                "status": SkillStatus.COMPLETED,
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.json()["status"], SkillStatus.COMPLETED)
        self.assertAlmostEqual(update_response.json()["confidence"], 0.91)
        self.assertIsNone(update_response.json()["superseded_by"])
        self.assertEqual(invalid_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            invalid_response.json()["content"][0],
            "Content must belong to the selected project.",
        )

    def test_review_queue_routes_cover_list_patch_and_workflow_actions(self):
        list_response = self.client.get(
            reverse(
                "ninja-api:list_review_queue_items",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        detail_response = self.client.get(
            reverse(
                "ninja-api:get_review_queue_item",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "review_item_id": _require_pk(self.owner_review_item),
                },
            )
        )
        create_response = self.client.post(
            reverse(
                "ninja-api:list_review_queue_items",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "content": _require_pk(self.owner_content),
                "reason": ReviewReason.LOW_CONFIDENCE_CLASSIFICATION,
                "confidence": 0.33,
                "failed_node": "classify",
                "failure_detail": "Low confidence.",
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.json()), 1)
        self.assertEqual(
            list_response.json()[0]["id"], _require_pk(self.owner_review_item)
        )
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            detail_response.json()["content"], _require_pk(self.owner_content)
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        created_review_id = create_response.json()["id"]
        patch_response = self.client.patch(
            reverse(
                "ninja-api:get_review_queue_item",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "review_item_id": created_review_id,
                },
            ),
            {
                "resolved": True,
                "resolution": ReviewResolution.HUMAN_APPROVED,
            },
            format="json",
        )
        resolve_response = self.client.post(
            reverse(
                "ninja-api:resolve_review_queue_item_route",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "review_item_id": _require_pk(self.owner_review_item),
                },
            ),
            format="json",
        )
        archive_target = ReviewQueue.objects.create(
            project=self.owner_project,
            content=self.owner_content,
            reason=ReviewReason.CIRCUIT_BREAKER_OPEN,
            confidence=0.14,
            failed_node="summarize",
            failure_detail="Paused for inspection.",
        )
        archive_response = self.client.post(
            reverse(
                "ninja-api:archive_review_queue_item_route",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "review_item_id": _require_pk(archive_target),
                },
            ),
            format="json",
        )
        invalid_response = self.client.post(
            reverse(
                "ninja-api:list_review_queue_items",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "content": _require_pk(self.other_content),
                "reason": ReviewReason.BORDERLINE_RELEVANCE,
                "confidence": 0.5,
            },
            format="json",
        )

        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertTrue(patch_response.json()["resolved"])
        self.assertEqual(
            patch_response.json()["resolution"],
            ReviewResolution.HUMAN_APPROVED,
        )
        self.assertEqual(resolve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resolve_response.json()["resolution"],
            ReviewResolution.MANUALLY_RESOLVED,
        )
        self.assertTrue(resolve_response.json()["resolved"])
        self.assertIsNotNone(resolve_response.json()["resolved_at"])
        self.assertEqual(archive_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            archive_response.json()["resolution"], ReviewResolution.ARCHIVED
        )
        self.assertEqual(invalid_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            invalid_response.json()["content"][0],
            "Content must belong to the selected project.",
        )

    def test_review_queue_retry_handles_eager_and_queued_modes(self):
        with self.settings(CELERY_TASK_ALWAYS_EAGER=True):
            with patch(
                "pipeline.ninja_api.retry_pipeline_review_item",
                return_value={
                    "review_item_id": _require_pk(self.owner_review_item),
                    "status": "retried",
                },
            ) as retry_mock:
                eager_response = self.client.post(
                    reverse(
                        "ninja-api:retry_review_queue_item_route",
                        kwargs={
                            "project_id": _require_pk(self.owner_project),
                            "review_item_id": _require_pk(self.owner_review_item),
                        },
                    ),
                    format="json",
                )

        with self.settings(CELERY_TASK_ALWAYS_EAGER=False):
            with patch(
                "pipeline.ninja_api.retry_pipeline_review_item.delay"
            ) as delay_mock:
                queued_response = self.client.post(
                    reverse(
                        "ninja-api:retry_review_queue_item_route",
                        kwargs={
                            "project_id": _require_pk(self.owner_project),
                            "review_item_id": _require_pk(self.owner_review_item),
                        },
                    ),
                    format="json",
                )

        retry_mock.assert_called_once_with(_require_pk(self.owner_review_item))
        self.assertEqual(eager_response.status_code, status.HTTP_200_OK)
        self.assertEqual(eager_response.json()["status"], "retried")
        delay_mock.assert_called_once_with(_require_pk(self.owner_review_item))
        self.assertEqual(queued_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(queued_response.json()["status"], "queued")

    def test_pipeline_ninja_permissions_match_existing_roles(self):
        _typed_client(self.client).force_login(self.reader)

        reader_skill_results = self.client.get(
            reverse(
                "ninja-api:list_skill_results",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        reader_review_queue = self.client.get(
            reverse(
                "ninja-api:list_review_queue_items",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        reader_skill_create = self.client.post(
            reverse(
                "ninja-api:list_skill_results",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "content": _require_pk(self.owner_content),
                "skill_name": "summarization",
                "status": SkillStatus.PENDING,
            },
            format="json",
        )

        self.assertEqual(reader_skill_results.status_code, status.HTTP_200_OK)
        self.assertEqual(reader_review_queue.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(reader_skill_create.status_code, status.HTTP_403_FORBIDDEN)

        _typed_client(self.client).force_login(self.member)
        member_review_queue = self.client.get(
            reverse(
                "ninja-api:list_review_queue_items",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        self.assertEqual(member_review_queue.status_code, status.HTTP_200_OK)

    def test_pipeline_ninja_requires_authentication(self):
        self.client.logout()

        response = self.client.get(
            reverse(
                "ninja-api:list_skill_results",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.json(), {"detail": "Unauthorized"})
