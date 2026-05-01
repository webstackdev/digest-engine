from typing import Any, cast
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from content.models import Content, FeedbackType, UserFeedback
from entities.models import Entity, EntityCandidate
from pipeline.models import ReviewQueue, ReviewReason
from projects.model_support import SourcePluginName
from projects.models import BlueskyCredentials, Project, ProjectMembership, ProjectRole
from trends.models import ThemeSuggestion, TopicCentroidSnapshot, TopicCluster


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed permission test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _typed_client(client: object) -> APIClient:
    """Cast the DRF test client so Pylance sees APIClient methods."""

    return cast(APIClient, client)


def _create_user(user_model: type[Any], **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


class ProjectRolePermissionTests(APITestCase):
    def setUp(self):
        queue_centroid_patcher = patch("content.signals.queue_topic_centroid_recompute")
        queue_centroid_patcher.start()
        self.addCleanup(queue_centroid_patcher.stop)

        user_model = get_user_model()
        self.admin_user = _create_user(
            user_model,
            username="project-admin",
            password="testpass123",
        )
        self.member_user = _create_user(
            user_model,
            username="project-member",
            password="testpass123",
        )
        self.reader_user = _create_user(
            user_model,
            username="project-reader",
            password="testpass123",
        )
        self.outsider_user = _create_user(
            user_model,
            username="outsider",
            password="testpass123",
        )

        self.project = Project.objects.create(
            name="Permissions Project",
            topic_description="Platform engineering",
        )

        ProjectMembership.objects.bulk_create(
            [
                ProjectMembership(
                    user=self.admin_user,
                    project=self.project,
                    role=ProjectRole.ADMIN,
                ),
                ProjectMembership(
                    user=self.member_user,
                    project=self.project,
                    role=ProjectRole.MEMBER,
                ),
                ProjectMembership(
                    user=self.reader_user,
                    project=self.project,
                    role=ProjectRole.READER,
                ),
            ]
        )

        self.entity = Entity.objects.create(
            project=self.project,
            name="Permissions Entity",
            type="vendor",
        )
        self.content = Content.objects.create(
            project=self.project,
            url="https://example.com/permissions-content",
            title="Permissions Content",
            author="Author",
            entity=self.entity,
            source_plugin=SourcePluginName.RSS,
            published_date="2026-04-29T00:00:00Z",
            content_text="Permissions content body.",
        )
        self.entity_candidate = EntityCandidate.objects.create(
            project=self.project,
            name="Candidate Vendor",
            suggested_type="vendor",
            first_seen_in=self.content,
        )
        self.review_queue_item = ReviewQueue.objects.create(
            project=self.project,
            content=self.content,
            reason=ReviewReason.BORDERLINE_RELEVANCE,
            confidence=0.55,
        )
        self.topic_centroid_snapshot = TopicCentroidSnapshot.objects.create(
            project=self.project,
            centroid_active=True,
            centroid_vector=[1.0, 0.0],
            feedback_count=3,
            upvote_count=2,
            downvote_count=1,
            drift_from_previous=0.1,
            drift_from_week_ago=0.2,
        )
        self.topic_cluster = TopicCluster.objects.create(
            project=self.project,
            first_seen_at="2026-04-28T00:00:00Z",
            last_seen_at="2026-04-29T00:00:00Z",
            is_active=True,
            member_count=1,
            dominant_entity=self.entity,
        )
        self.theme_suggestion = ThemeSuggestion.objects.create(
            project=self.project,
            cluster=self.topic_cluster,
            title="Permissions Theme",
            pitch="Pitch",
            why_it_matters="Why",
            suggested_angle="Angle",
            velocity_at_creation=0.8,
            novelty_score=0.7,
        )
        self.member_feedback = UserFeedback.objects.create(
            project=self.project,
            content=self.content,
            user=self.member_user,
            feedback_type=FeedbackType.UPVOTE,
        )
        self.admin_feedback = UserFeedback.objects.create(
            project=self.project,
            content=self.content,
            user=self.admin_user,
            feedback_type=FeedbackType.DOWNVOTE,
        )
        self.bluesky_credentials = BlueskyCredentials.objects.create(
            project=self.project,
            handle="permissions-project.bsky.social",
        )

    def test_project_list_includes_resolved_reader_role(self):
        _typed_client(self.client).force_authenticate(self.reader_user)

        response = self.client.get(reverse("v1:project-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["user_role"], ProjectRole.READER)

    def test_reader_is_denied_contributor_and_admin_endpoints(self):
        _typed_client(self.client).force_authenticate(self.reader_user)

        cases = [
            (
                "patch",
                reverse("v1:project-detail", kwargs={"id": _require_pk(self.project)}),
                {"name": "Reader Update"},
            ),
            (
                "post",
                reverse(
                    "v1:project-rotate-intake-token",
                    kwargs={"id": _require_pk(self.project)},
                ),
                None,
            ),
            (
                "get",
                reverse(
                    "v1:project-review-queue-list",
                    kwargs={"project_id": _require_pk(self.project)},
                ),
                None,
            ),
            (
                "post",
                reverse(
                    "v1:project-source-config-list",
                    kwargs={"project_id": _require_pk(self.project)},
                ),
                {
                    "plugin_name": SourcePluginName.RSS,
                    "config": {"feed_url": "https://example.com/feed.xml"},
                    "is_active": True,
                },
            ),
            (
                "get",
                reverse(
                    "v1:project-bluesky-credentials-list",
                    kwargs={"project_id": _require_pk(self.project)},
                ),
                None,
            ),
            (
                "post",
                reverse(
                    "v1:project-feedback-list",
                    kwargs={"project_id": _require_pk(self.project)},
                ),
                {
                    "content": _require_pk(self.content),
                    "feedback_type": FeedbackType.UPVOTE,
                },
            ),
            (
                "post",
                reverse(
                    "v1:project-entity-candidate-accept",
                    kwargs={
                        "project_id": _require_pk(self.project),
                        "pk": _require_pk(self.entity_candidate),
                    },
                ),
                None,
            ),
            (
                "get",
                reverse(
                    "v1:project-topic-centroid-snapshot-summary",
                    kwargs={"project_id": _require_pk(self.project)},
                ),
                None,
            ),
            (
                "post",
                reverse(
                    "v1:project-theme-suggestion-accept",
                    kwargs={
                        "project_id": _require_pk(self.project),
                        "pk": _require_pk(self.theme_suggestion),
                    },
                ),
                None,
            ),
        ]

        for method, url, payload in cases:
            with self.subTest(method=method, url=url):
                response = getattr(self.client, method)(url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_can_use_contributor_endpoints_but_not_admin_only_ones(self):
        _typed_client(self.client).force_authenticate(self.member_user)

        review_queue_response = self.client.get(
            reverse(
                "v1:project-review-queue-list",
                kwargs={"project_id": _require_pk(self.project)},
            )
        )
        self.assertEqual(review_queue_response.status_code, status.HTTP_200_OK)

        source_config_response = self.client.post(
            reverse(
                "v1:project-source-config-list",
                kwargs={"project_id": _require_pk(self.project)},
            ),
            {
                "plugin_name": SourcePluginName.RSS,
                "config": {"feed_url": "https://example.com/feed.xml"},
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(source_config_response.status_code, status.HTTP_201_CREATED)

        topic_summary_response = self.client.get(
            reverse(
                "v1:project-topic-centroid-snapshot-summary",
                kwargs={"project_id": _require_pk(self.project)},
            )
        )
        self.assertEqual(topic_summary_response.status_code, status.HTTP_200_OK)

        accept_candidate_response = self.client.post(
            reverse(
                "v1:project-entity-candidate-accept",
                kwargs={
                    "project_id": _require_pk(self.project),
                    "pk": _require_pk(self.entity_candidate),
                },
            ),
            format="json",
        )
        self.assertEqual(accept_candidate_response.status_code, status.HTTP_200_OK)

        delete_own_feedback_response = self.client.delete(
            reverse(
                "v1:project-feedback-detail",
                kwargs={
                    "project_id": _require_pk(self.project),
                    "pk": _require_pk(self.member_feedback),
                },
            )
        )
        self.assertEqual(
            delete_own_feedback_response.status_code, status.HTTP_204_NO_CONTENT
        )

        update_project_response = self.client.patch(
            reverse("v1:project-detail", kwargs={"id": _require_pk(self.project)}),
            {"name": "Member Update"},
            format="json",
        )
        self.assertEqual(update_project_response.status_code, status.HTTP_403_FORBIDDEN)

        list_credentials_response = self.client.get(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": _require_pk(self.project)},
            )
        )
        self.assertEqual(
            list_credentials_response.status_code, status.HTTP_403_FORBIDDEN
        )

        rotate_token_response = self.client.post(
            reverse(
                "v1:project-rotate-intake-token",
                kwargs={"id": _require_pk(self.project)},
            ),
            format="json",
        )
        self.assertEqual(rotate_token_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_cannot_delete_other_users_feedback(self):
        _typed_client(self.client).force_authenticate(self.member_user)

        response = self.client.delete(
            reverse(
                "v1:project-feedback-detail",
                kwargs={
                    "project_id": _require_pk(self.project),
                    "pk": _require_pk(self.admin_feedback),
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_access_admin_endpoints_and_delete_other_feedback(self):
        _typed_client(self.client).force_authenticate(self.admin_user)

        update_project_response = self.client.patch(
            reverse("v1:project-detail", kwargs={"id": _require_pk(self.project)}),
            {"name": "Admin Updated Project"},
            format="json",
        )
        self.assertEqual(update_project_response.status_code, status.HTTP_200_OK)

        list_credentials_response = self.client.get(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": _require_pk(self.project)},
            )
        )
        self.assertEqual(list_credentials_response.status_code, status.HTTP_200_OK)

        rotate_token_response = self.client.post(
            reverse(
                "v1:project-rotate-intake-token",
                kwargs={"id": _require_pk(self.project)},
            ),
            format="json",
        )
        self.assertEqual(rotate_token_response.status_code, status.HTTP_200_OK)

        delete_feedback_response = self.client.delete(
            reverse(
                "v1:project-feedback-detail",
                kwargs={
                    "project_id": _require_pk(self.project),
                    "pk": _require_pk(self.member_feedback),
                },
            )
        )
        self.assertEqual(
            delete_feedback_response.status_code, status.HTTP_204_NO_CONTENT
        )

    def test_outsider_cannot_access_project_resources(self):
        _typed_client(self.client).force_authenticate(self.outsider_user)

        response = self.client.get(
            reverse("v1:project-detail", kwargs={"id": _require_pk(self.project)})
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
