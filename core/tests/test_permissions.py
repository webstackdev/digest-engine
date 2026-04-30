from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import (
    Content,
    Entity,
    EntityCandidate,
    FeedbackType,
    ReviewQueue,
    ReviewReason,
    TopicCentroidSnapshot,
    UserFeedback,
)
from projects.model_support import SourcePluginName
from projects.models import BlueskyCredentials, Project, ProjectMembership, ProjectRole


class ProjectRolePermissionTests(APITestCase):
    def setUp(self):
        queue_centroid_patcher = patch("core.signals.queue_topic_centroid_recompute")
        queue_centroid_patcher.start()
        self.addCleanup(queue_centroid_patcher.stop)

        user_model = get_user_model()
        self.admin_user = user_model.objects.create_user(
            username="project-admin",
            password="testpass123",
        )
        self.member_user = user_model.objects.create_user(
            username="project-member",
            password="testpass123",
        )
        self.reader_user = user_model.objects.create_user(
            username="project-reader",
            password="testpass123",
        )
        self.outsider_user = user_model.objects.create_user(
            username="outsider",
            password="testpass123",
        )

        self.group = Group.objects.create(name="permissions-team")
        self.project = Project.objects.create(
            name="Permissions Project",
            group=self.group,
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
        self.client.force_authenticate(self.reader_user)

        response = self.client.get(reverse("v1:project-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["user_role"], ProjectRole.READER)

    def test_reader_is_denied_contributor_and_admin_endpoints(self):
        self.client.force_authenticate(self.reader_user)

        cases = [
            (
                "patch",
                reverse("v1:project-detail", kwargs={"id": self.project.id}),
                {"name": "Reader Update"},
            ),
            (
                "post",
                reverse(
                    "v1:project-rotate-intake-token",
                    kwargs={"id": self.project.id},
                ),
                None,
            ),
            (
                "get",
                reverse(
                    "v1:project-review-queue-list",
                    kwargs={"project_id": self.project.id},
                ),
                None,
            ),
            (
                "post",
                reverse(
                    "v1:project-source-config-list",
                    kwargs={"project_id": self.project.id},
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
                    kwargs={"project_id": self.project.id},
                ),
                None,
            ),
            (
                "post",
                reverse(
                    "v1:project-feedback-list",
                    kwargs={"project_id": self.project.id},
                ),
                {
                    "content": self.content.id,
                    "feedback_type": FeedbackType.UPVOTE,
                },
            ),
            (
                "post",
                reverse(
                    "v1:project-entity-candidate-accept",
                    kwargs={
                        "project_id": self.project.id,
                        "pk": self.entity_candidate.id,
                    },
                ),
                None,
            ),
            (
                "get",
                reverse(
                    "v1:project-topic-centroid-snapshot-summary",
                    kwargs={"project_id": self.project.id},
                ),
                None,
            ),
        ]

        for method, url, payload in cases:
            with self.subTest(method=method, url=url):
                response = getattr(self.client, method)(url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_can_use_contributor_endpoints_but_not_admin_only_ones(self):
        self.client.force_authenticate(self.member_user)

        review_queue_response = self.client.get(
            reverse(
                "v1:project-review-queue-list",
                kwargs={"project_id": self.project.id},
            )
        )
        self.assertEqual(review_queue_response.status_code, status.HTTP_200_OK)

        source_config_response = self.client.post(
            reverse(
                "v1:project-source-config-list",
                kwargs={"project_id": self.project.id},
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
                kwargs={"project_id": self.project.id},
            )
        )
        self.assertEqual(topic_summary_response.status_code, status.HTTP_200_OK)

        accept_candidate_response = self.client.post(
            reverse(
                "v1:project-entity-candidate-accept",
                kwargs={
                    "project_id": self.project.id,
                    "pk": self.entity_candidate.id,
                },
            ),
            format="json",
        )
        self.assertEqual(accept_candidate_response.status_code, status.HTTP_200_OK)

        delete_own_feedback_response = self.client.delete(
            reverse(
                "v1:project-feedback-detail",
                kwargs={
                    "project_id": self.project.id,
                    "pk": self.member_feedback.id,
                },
            )
        )
        self.assertEqual(
            delete_own_feedback_response.status_code, status.HTTP_204_NO_CONTENT
        )

        update_project_response = self.client.patch(
            reverse("v1:project-detail", kwargs={"id": self.project.id}),
            {"name": "Member Update"},
            format="json",
        )
        self.assertEqual(update_project_response.status_code, status.HTTP_403_FORBIDDEN)

        list_credentials_response = self.client.get(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": self.project.id},
            )
        )
        self.assertEqual(
            list_credentials_response.status_code, status.HTTP_403_FORBIDDEN
        )

        rotate_token_response = self.client.post(
            reverse("v1:project-rotate-intake-token", kwargs={"id": self.project.id}),
            format="json",
        )
        self.assertEqual(rotate_token_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_cannot_delete_other_users_feedback(self):
        self.client.force_authenticate(self.member_user)

        response = self.client.delete(
            reverse(
                "v1:project-feedback-detail",
                kwargs={
                    "project_id": self.project.id,
                    "pk": self.admin_feedback.id,
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_access_admin_endpoints_and_delete_other_feedback(self):
        self.client.force_authenticate(self.admin_user)

        update_project_response = self.client.patch(
            reverse("v1:project-detail", kwargs={"id": self.project.id}),
            {"name": "Admin Updated Project"},
            format="json",
        )
        self.assertEqual(update_project_response.status_code, status.HTTP_200_OK)

        list_credentials_response = self.client.get(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": self.project.id},
            )
        )
        self.assertEqual(list_credentials_response.status_code, status.HTTP_200_OK)

        rotate_token_response = self.client.post(
            reverse("v1:project-rotate-intake-token", kwargs={"id": self.project.id}),
            format="json",
        )
        self.assertEqual(rotate_token_response.status_code, status.HTTP_200_OK)

        delete_feedback_response = self.client.delete(
            reverse(
                "v1:project-feedback-detail",
                kwargs={
                    "project_id": self.project.id,
                    "pk": self.member_feedback.id,
                },
            )
        )
        self.assertEqual(
            delete_feedback_response.status_code, status.HTTP_204_NO_CONTENT
        )

    def test_outsider_cannot_access_project_resources(self):
        self.client.force_authenticate(self.outsider_user)

        response = self.client.get(
            reverse("v1:project-detail", kwargs={"id": self.project.id})
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
