from typing import Any, cast
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from content.models import Content, FeedbackType, UserFeedback
from entities.models import Entity, EntityCandidate
from ingestion.models import IngestionRun, RunStatus
from newsletters.models import IntakeAllowlist, NewsletterIntake, NewsletterIntakeStatus
from pipeline.models import ReviewQueue, ReviewReason, SkillResult, SkillStatus
from projects.model_support import SourcePluginName
from projects.models import (
    BlueskyCredentials,
    Project,
    ProjectConfig,
    ProjectMembership,
    ProjectRole,
    SourceConfig,
)
from trends.models import TopicCentroidSnapshot


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


class ProjectScopedApiTests(APITestCase):
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
        self.owner_config = ProjectConfig.objects.create(project=self.owner_project)
        self.owner_skill_result = SkillResult.objects.create(
            project=self.owner_project,
            content=self.owner_content,
            skill_name="summarization",
            status=SkillStatus.COMPLETED,
            result_data={"summary": "Owner summary"},
        )
        self.owner_ingestion_run = IngestionRun.objects.create(
            project=self.owner_project,
            plugin_name="rss",
            status=RunStatus.SUCCESS,
            items_fetched=5,
            items_ingested=4,
        )
        self.owner_intake_allowlist = IntakeAllowlist.objects.create(
            project=self.owner_project,
            sender_email="sender@example.com",
        )
        self.owner_newsletter_intake = NewsletterIntake.objects.create(
            project=self.owner_project,
            sender_email="sender@example.com",
            subject="Owner Digest",
            raw_text="See https://example.com/post",
            message_id="owner-intake-1",
            status=NewsletterIntakeStatus.EXTRACTED,
            extraction_result={
                "method": "heuristic",
                "items": [
                    {
                        "url": "https://example.com/post",
                        "title": "Example Post",
                        "excerpt": "A short preview",
                        "position": 1,
                    }
                ],
            },
        )
        self.owner_review_queue = ReviewQueue.objects.create(
            project=self.owner_project,
            content=self.owner_content,
            reason=ReviewReason.BORDERLINE_RELEVANCE,
            confidence=0.51,
        )
        self.owner_source_config = SourceConfig.objects.create(
            project=self.owner_project,
            plugin_name=SourcePluginName.RSS,
            config={"feed_url": "https://example.com/feed.xml"},
        )
        self.owner_topic_centroid_snapshot = TopicCentroidSnapshot.objects.create(
            project=self.owner_project,
            centroid_active=True,
            centroid_vector=[1.0, 0.0],
            feedback_count=10,
            upvote_count=8,
            downvote_count=2,
            drift_from_previous=0.1,
            drift_from_week_ago=0.2,
        )
        _typed_client(self.client).force_authenticate(self.owner)

    def assert_standardized_validation_error(self, payload, attr):
        self.assertEqual(payload["type"], "validation_error")
        self.assertTrue(any(error["attr"] == attr for error in payload["errors"]))

    def test_authenticated_nested_list_endpoints_smoke(self):
        list_endpoints = [
            reverse(
                "v1:project-config-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-entity-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-entity-candidate-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-content-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-skill-result-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-feedback-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-ingestion-run-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-mastodon-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-intake-allowlist-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-newsletter-intake-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-source-config-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-topic-centroid-snapshot-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            reverse(
                "v1:project-review-queue-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
        ]

        for endpoint in list_endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch("content.signals.queue_topic_centroid_recompute")
    def test_authenticated_nested_detail_endpoints_smoke(self, queue_centroid_mock):
        detail_endpoints = [
            reverse(
                "v1:project-config-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_config),
                },
            ),
            reverse(
                "v1:project-entity-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_entity),
                },
            ),
            reverse(
                "v1:project-content-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_content),
                },
            ),
            reverse(
                "v1:project-skill-result-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_skill_result),
                },
            ),
            reverse(
                "v1:project-ingestion-run-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_ingestion_run),
                },
            ),
            reverse(
                "v1:project-intake-allowlist-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_intake_allowlist),
                },
            ),
            reverse(
                "v1:project-newsletter-intake-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_newsletter_intake),
                },
            ),
            reverse(
                "v1:project-source-config-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_source_config),
                },
            ),
            reverse(
                "v1:project-topic-centroid-snapshot-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_topic_centroid_snapshot),
                },
            ),
            reverse(
                "v1:project-review-queue-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_review_queue),
                },
            ),
        ]

        candidate = EntityCandidate.objects.create(
            project=self.owner_project,
            name="Smoke Candidate",
            suggested_type="organization",
            first_seen_in=self.owner_content,
        )
        detail_endpoints.append(
            reverse(
                "v1:project-entity-candidate-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(candidate),
                },
            )
        )

        feedback = UserFeedback.objects.create(
            project=self.owner_project,
            content=self.owner_content,
            user=self.owner,
            feedback_type=FeedbackType.UPVOTE,
        )
        detail_endpoints.append(
            reverse(
                "v1:project-feedback-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(feedback),
                },
            )
        )

        credentials = BlueskyCredentials.objects.create(
            project=self.owner_project,
            handle="owner-project.bsky.social",
        )
        detail_endpoints.append(
            reverse(
                "v1:project-bluesky-credentials-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(credentials),
                },
            )
        )

        for endpoint in detail_endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
