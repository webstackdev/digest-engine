from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from content.models import Content, FeedbackType, UserFeedback
from entities.models import Entity
from pipeline.models import SkillResult, SkillStatus
from projects.model_support import SourcePluginName
from projects.models import Project, ProjectMembership, ProjectRole
from trends.models import ThemeSuggestion, ThemeSuggestionStatus, TopicCluster


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


class ContentApiTests(APITestCase):
    """Exercise content- and feedback-owned project API endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
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
        _typed_client(self.client).force_authenticate(self.owner)

    def assert_standardized_validation_error(
        self, payload: dict[str, object], attr: str
    ):
        """Assert the repo-standardized validation payload shape."""

        self.assertEqual(payload["type"], "validation_error")
        errors = cast(list[dict[str, object]], payload["errors"])
        self.assertTrue(any(error["attr"] == attr for error in errors))

    @patch("content.signals.queue_topic_centroid_recompute")
    def test_feedback_create_assigns_current_user(self, queue_centroid_mock):
        response = self.client.post(
            reverse(
                "v1:project-feedback-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "content": _require_pk(self.owner_content),
                "feedback_type": FeedbackType.UPVOTE,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = UserFeedback.objects.get()
        self.assertEqual(feedback.user, self.owner)
        self.assertEqual(feedback.feedback_type, FeedbackType.UPVOTE)
        queue_centroid_mock.assert_called_once_with(_require_pk(self.owner_project))

    def test_feedback_rejects_cross_project_content(self):
        response = self.client.post(
            reverse(
                "v1:project-feedback-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "content": _require_pk(self.other_content),
                "feedback_type": FeedbackType.DOWNVOTE,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(response.json(), "content")

    def test_content_create_uses_project_from_url(self):
        response = self.client.post(
            reverse(
                "v1:project-content-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "url": "https://example.com/new",
                "title": "New Content",
                "author": "Owner Author",
                "entity": _require_pk(self.owner_entity),
                "source_plugin": "rss",
                "published_date": "2026-04-22T00:00:00Z",
                "content_text": "Nested content text",
                "project": _require_pk(self.other_project),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_content = Content.objects.get(title="New Content")
        self.assertEqual(created_content.project, self.owner_project)

    def test_content_detail_includes_summary_text(self):
        self.owner_content.summary_text = "A concise summary ready for editors."
        self.owner_content.save(update_fields=["summary_text"])

        response = self.client.get(
            reverse(
                "v1:project-content-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_content),
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json()["summary_text"], "A concise summary ready for editors."
        )

    @patch("core.tasks.run_relevance_scoring_skill.delay")
    def test_content_skill_action_queues_relevance_scoring(
        self, run_relevance_scoring_delay_mock
    ):
        response = self.client.post(
            f"/api/v1/projects/{_require_pk(self.owner_project)}/contents/{_require_pk(self.owner_content)}/skills/relevance_scoring/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        pending_result = SkillResult.objects.get(
            content=self.owner_content,
            skill_name="relevance_scoring",
            superseded_by__isnull=True,
        )
        run_relevance_scoring_delay_mock.assert_called_once_with(
            _require_pk(pending_result)
        )
        self.owner_content.refresh_from_db()
        self.assertIsNone(self.owner_content.relevance_score)
        self.assertEqual(response.json()["skill_name"], "relevance_scoring")
        self.assertEqual(response.json()["status"], SkillStatus.PENDING)

    @patch("core.tasks.run_summarization_skill.delay")
    def test_content_skill_action_queues_summarization(
        self, run_summarization_delay_mock
    ):
        self.owner_content.relevance_score = 0.25
        self.owner_content.save(update_fields=["relevance_score"])

        response = self.client.post(
            f"/api/v1/projects/{_require_pk(self.owner_project)}/contents/{_require_pk(self.owner_content)}/skills/summarization/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        pending_result = SkillResult.objects.get(
            content=self.owner_content,
            skill_name="summarization",
            superseded_by__isnull=True,
        )
        run_summarization_delay_mock.assert_called_once_with(
            _require_pk(pending_result)
        )
        self.assertEqual(response.json()["skill_name"], "summarization")
        self.assertEqual(response.json()["status"], SkillStatus.PENDING)

    @patch("core.pipeline.search_similar_content")
    def test_content_skill_action_runs_find_related(self, search_similar_content_mock):
        search_similar_content_mock.return_value = [
            SimpleNamespace(
                score=0.91,
                payload={
                    "content_id": _require_pk(self.other_content),
                    "title": self.other_content.title,
                    "url": self.other_content.url,
                    "published_date": self.other_content.published_date,
                    "source_plugin": self.other_content.source_plugin,
                },
            )
        ]

        response = self.client.post(
            f"/api/v1/projects/{_require_pk(self.owner_project)}/contents/{_require_pk(self.owner_content)}/skills/find_related/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["skill_name"], "find_related")
        self.assertEqual(response.json()["status"], SkillStatus.COMPLETED)
        self.assertEqual(
            response.json()["result_data"]["related_items"][0]["content_id"],
            _require_pk(self.other_content),
        )

    def test_content_detail_includes_newsletter_promotion_state(self):
        cluster = TopicCluster.objects.create(
            project=self.owner_project,
            first_seen_at="2026-04-22T00:00:00Z",
            last_seen_at="2026-04-24T00:00:00Z",
            is_active=True,
            member_count=1,
            dominant_entity=self.owner_entity,
        )
        suggestion = ThemeSuggestion.objects.create(
            project=self.owner_project,
            cluster=cluster,
            title="Promoted Theme",
            pitch="Pitch",
            why_it_matters="Why",
            suggested_angle="Angle",
            velocity_at_creation=0.9,
            novelty_score=0.8,
            status=ThemeSuggestionStatus.ACCEPTED,
            decided_by=self.owner,
        )
        self.owner_content.newsletter_promotion_theme = suggestion
        self.owner_content.newsletter_promotion_by = self.owner
        self.owner_content.newsletter_promotion_at = "2026-04-24T00:00:00Z"
        self.owner_content.save(
            update_fields=[
                "newsletter_promotion_theme",
                "newsletter_promotion_by",
                "newsletter_promotion_at",
            ]
        )

        response = self.client.get(
            reverse(
                "v1:project-content-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_content),
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json()["newsletter_promotion_theme"],
            _require_pk(suggestion),
        )
        self.assertEqual(
            response.json()["newsletter_promotion_by"],
            _require_pk(self.owner),
        )
        self.assertIsNotNone(response.json()["newsletter_promotion_at"])

    def test_content_detail_includes_duplicate_state(self):
        canonical = self.owner_content
        canonical.canonical_url = "https://example.com/owner"
        canonical.duplicate_signal_count = 1
        canonical.save(update_fields=["canonical_url", "duplicate_signal_count"])
        duplicate = Content.objects.create(
            project=self.owner_project,
            url="https://example.com/owner?utm_source=reddit",
            canonical_url="https://example.com/owner",
            title="Duplicate Owner Content",
            author="Owner Author",
            entity=self.owner_entity,
            source_plugin="reddit",
            published_date="2026-04-22T00:00:00Z",
            content_text="Duplicate content text",
            duplicate_of=canonical,
            is_active=False,
        )

        response = self.client.get(
            reverse(
                "v1:project-content-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(duplicate),
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["canonical_url"], "https://example.com/owner")
        self.assertEqual(response.json()["duplicate_of"], _require_pk(canonical))
        self.assertEqual(response.json()["duplicate_signal_count"], 0)
