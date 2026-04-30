from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import (
    Content,
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityCandidateStatus,
    EntityMention,
    FeedbackType,
    IngestionRun,
    IntakeAllowlist,
    NewsletterIntake,
    NewsletterIntakeStatus,
    ReviewQueue,
    ReviewReason,
    RunStatus,
    SkillResult,
    SkillStatus,
    TopicCentroidSnapshot,
    UserFeedback,
)
from projects.model_support import SourcePluginName
from projects.models import (
    BlueskyCredentials,
    Project,
    ProjectConfig,
    ProjectMembership,
    ProjectRole,
    SourceConfig,
)


class ProjectScopedApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(
            username="owner", password="testpass123"
        )
        self.other_user = user_model.objects.create_user(
            username="other", password="testpass123"
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
        self.client.force_authenticate(self.owner)

    def assert_standardized_validation_error(self, payload, attr):
        self.assertEqual(payload["type"], "validation_error")
        self.assertTrue(any(error["attr"] == attr for error in payload["errors"]))

    def test_project_list_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(reverse("v1:project-list"), HTTP_HOST="localhost")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.json(),
            {
                "type": "client_error",
                "errors": [
                    {
                        "code": "not_authenticated",
                        "detail": "Authentication credentials were not provided.",
                        "attr": None,
                    }
                ],
            },
        )

    def test_project_list_is_scoped_to_request_user_memberships(self):
        BlueskyCredentials.objects.create(
            project=self.owner_project,
            handle="owner-project.bsky.social",
            is_active=True,
            last_error="",
        )

        response = self.client.get(reverse("v1:project-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], self.owner_project.id)
        self.assertEqual(response.json()[0]["user_role"], ProjectRole.ADMIN)
        self.assertEqual(
            response.json()[0]["intake_token"], self.owner_project.intake_token
        )
        self.assertFalse(response.json()[0]["intake_enabled"])
        self.assertTrue(response.json()[0]["has_bluesky_credentials"])
        self.assertEqual(
            response.json()[0]["bluesky_handle"], "owner-project.bsky.social"
        )
        self.assertTrue(response.json()[0]["bluesky_is_active"])
        self.assertEqual(response.json()[0]["bluesky_last_error"], "")

    def test_project_rotate_intake_token_returns_updated_project(self):
        original_token = self.owner_project.intake_token

        response = self.client.post(
            reverse(
                "v1:project-rotate-intake-token",
                kwargs={"id": self.owner_project.id},
            ),
            format="json",
        )

        self.owner_project.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(self.owner_project.intake_token, original_token)
        self.assertEqual(
            response.json()["intake_token"], self.owner_project.intake_token
        )

    def test_entity_list_is_scoped_to_request_user_project(self):
        response = self.client.get(
            reverse(
                "v1:project-entity-list", kwargs={"project_id": self.owner_project.id}
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], self.owner_entity.id)

    def test_entity_list_includes_recent_mentions(self):
        mention = EntityMention.objects.create(
            project=self.owner_project,
            content=self.owner_content,
            entity=self.owner_entity,
            role="subject",
            sentiment="neutral",
            span="Owner Entity",
            confidence=0.88,
        )

        response = self.client.get(
            reverse(
                "v1:project-entity-list", kwargs={"project_id": self.owner_project.id}
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["mention_count"], 1)
        self.assertEqual(response.json()[0]["latest_mentions"][0]["id"], mention.id)
        self.assertEqual(
            response.json()[0]["latest_mentions"][0]["content_title"],
            self.owner_content.title,
        )

    def test_entity_mentions_action_returns_full_mention_history(self):
        first_mention = EntityMention.objects.create(
            project=self.owner_project,
            content=self.owner_content,
            entity=self.owner_entity,
            role="subject",
            sentiment="neutral",
            span="Owner Entity",
            confidence=0.88,
        )
        second_content = Content.objects.create(
            project=self.owner_project,
            url="https://example.com/owner-second",
            title="Second Owner Content",
            author="Owner Author",
            entity=self.owner_entity,
            source_plugin="rss",
            published_date="2026-04-22T00:00:00Z",
            content_text="Another owner content text",
        )
        second_mention = EntityMention.objects.create(
            project=self.owner_project,
            content=second_content,
            entity=self.owner_entity,
            role="mentioned",
            sentiment="positive",
            span="Owner Entity",
            confidence=0.67,
        )

        response = self.client.get(
            reverse(
                "v1:project-entity-mentions",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_entity.id,
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response.json()[0]["id"], second_mention.id)
        self.assertEqual(response.json()[1]["id"], first_mention.id)
        self.assertEqual(response.json()[0]["content_title"], second_content.title)

    def test_intake_allowlist_list_is_scoped_to_request_user_project(self):
        other_allowlist = IntakeAllowlist.objects.create(
            project=self.other_project,
            sender_email="other@example.com",
        )

        response = self.client.get(
            reverse(
                "v1:project-intake-allowlist-list",
                kwargs={"project_id": self.owner_project.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], self.owner_intake_allowlist.id)
        self.assertFalse(response.json()[0]["is_confirmed"])
        self.assertNotEqual(response.json()[0]["id"], other_allowlist.id)

    def test_intake_allowlist_create_and_delete_manage_project_senders(self):
        create_response = self.client.post(
            reverse(
                "v1:project-intake-allowlist-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            {"sender_email": "new-sender@example.com"},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_allowlist = IntakeAllowlist.objects.get(
            project=self.owner_project,
            sender_email="new-sender@example.com",
        )
        self.assertEqual(create_response.json()["project"], self.owner_project.id)
        self.assertFalse(create_response.json()["is_confirmed"])

        delete_response = self.client.delete(
            reverse(
                "v1:project-intake-allowlist-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": created_allowlist.id,
                },
            )
        )

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            IntakeAllowlist.objects.filter(pk=created_allowlist.id).exists()
        )

    def test_bluesky_credentials_list_create_and_update_hide_stored_password(self):
        list_response = self.client.get(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": self.owner_project.id},
            )
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.json(), [])

        create_response = self.client.post(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            {
                "handle": "@Owner.Project.BSKY.social",
                "pds_url": "https://pds.example.com/xrpc/",
                "is_active": True,
                "app_password": "app-password",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        credentials = BlueskyCredentials.objects.get(project=self.owner_project)
        self.assertEqual(credentials.handle, "owner.project.bsky.social")
        self.assertEqual(credentials.pds_url, "https://pds.example.com")
        self.assertEqual(credentials.get_app_password(), "app-password")
        self.assertTrue(create_response.json()["has_stored_credential"])
        self.assertNotIn("app_password", create_response.json())

        update_response = self.client.patch(
            reverse(
                "v1:project-bluesky-credentials-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": credentials.id,
                },
            ),
            {
                "handle": "updated.bsky.social",
                "pds_url": "",
                "is_active": False,
            },
            format="json",
        )

        credentials.refresh_from_db()
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(credentials.handle, "updated.bsky.social")
        self.assertFalse(credentials.is_active)
        self.assertEqual(credentials.get_app_password(), "app-password")

    def test_bluesky_credentials_create_requires_app_password(self):
        response = self.client.post(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            {
                "handle": "owner.bsky.social",
                "pds_url": "",
                "is_active": True,
                "app_password": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(response.json(), "app_password")

    def test_newsletter_intake_list_returns_recent_project_history(self):
        other_intake = NewsletterIntake.objects.create(
            project=self.other_project,
            sender_email="other@example.com",
            subject="Other Digest",
            raw_text="Another item",
            message_id="other-intake-1",
        )

        response = self.client.get(
            reverse(
                "v1:project-newsletter-intake-list",
                kwargs={"project_id": self.owner_project.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], self.owner_newsletter_intake.id)
        self.assertEqual(response.json()[0]["status"], NewsletterIntakeStatus.EXTRACTED)
        self.assertEqual(
            response.json()[0]["extraction_result"]["items"][0]["title"],
            "Example Post",
        )
        self.assertNotEqual(response.json()[0]["id"], other_intake.id)

    def test_entity_list_supports_authority_score_ordering(self):
        second_entity = Entity.objects.create(
            project=self.owner_project,
            name="Second Entity",
            type="vendor",
            authority_score=0.9,
        )
        self.owner_entity.authority_score = 0.4
        self.owner_entity.save(update_fields=["authority_score"])

        response = self.client.get(
            reverse(
                "v1:project-entity-list", kwargs={"project_id": self.owner_project.id}
            ),
            {"ordering": "-authority_score"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["id"], second_entity.id)
        self.assertEqual(response.json()[1]["id"], self.owner_entity.id)

    def test_entity_authority_history_action_returns_recent_snapshots(self):
        first_snapshot = EntityAuthoritySnapshot.objects.create(
            entity=self.owner_entity,
            project=self.owner_project,
            mention_component=0.6,
            feedback_component=0.5,
            duplicate_component=0.5,
            decayed_prior=0.5,
            final_score=0.53,
        )
        second_snapshot = EntityAuthoritySnapshot.objects.create(
            entity=self.owner_entity,
            project=self.owner_project,
            mention_component=0.8,
            feedback_component=0.7,
            duplicate_component=0.6,
            decayed_prior=0.53,
            final_score=0.66,
        )

        response = self.client.get(
            reverse(
                "v1:project-entity-authority-history",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_entity.id,
                },
            ),
            {"limit": 1},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], second_snapshot.id)
        self.assertNotEqual(response.json()[0]["id"], first_snapshot.id)

    def test_topic_centroid_summary_action_returns_latest_snapshot_and_averages(self):
        latest_snapshot = TopicCentroidSnapshot.objects.create(
            project=self.owner_project,
            centroid_active=True,
            centroid_vector=[0.0, 1.0],
            feedback_count=14,
            upvote_count=11,
            downvote_count=3,
            drift_from_previous=0.3,
            drift_from_week_ago=0.4,
        )

        response = self.client.get(
            reverse(
                "v1:project-topic-centroid-snapshot-summary",
                kwargs={"project_id": self.owner_project.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["project"], self.owner_project.id)
        self.assertEqual(response.json()["snapshot_count"], 2)
        self.assertEqual(response.json()["active_snapshot_count"], 2)
        self.assertEqual(response.json()["latest_snapshot"]["id"], latest_snapshot.id)
        self.assertAlmostEqual(response.json()["avg_drift_from_previous"], 0.2)
        self.assertAlmostEqual(response.json()["avg_drift_from_week_ago"], 0.3)

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
                kwargs={"project_id": self.owner_project.id, "pk": duplicate.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["canonical_url"], "https://example.com/owner")
        self.assertEqual(response.json()["duplicate_of"], canonical.id)
        self.assertEqual(response.json()["duplicate_signal_count"], 0)

    def test_nested_entity_list_rejects_other_users_project(self):
        response = self.client.get(
            reverse(
                "v1:project-entity-list", kwargs={"project_id": self.other_project.id}
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_entity_candidate_list_is_scoped_to_request_user_project(self):
        owner_candidate = EntityCandidate.objects.create(
            project=self.owner_project,
            name="Owner Candidate",
            suggested_type="vendor",
            first_seen_in=self.owner_content,
        )
        EntityCandidate.objects.create(
            project=self.other_project,
            name="Other Candidate",
            suggested_type="organization",
            first_seen_in=self.other_content,
        )

        response = self.client.get(
            reverse(
                "v1:project-entity-candidate-list",
                kwargs={"project_id": self.owner_project.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], owner_candidate.id)

    def test_entity_candidate_accept_action_returns_updated_candidate(self):
        candidate = EntityCandidate.objects.create(
            project=self.owner_project,
            name="River Labs",
            suggested_type="vendor",
            first_seen_in=self.owner_content,
        )

        response = self.client.post(
            reverse(
                "v1:project-entity-candidate-accept",
                kwargs={"project_id": self.owner_project.id, "pk": candidate.id},
            ),
            format="json",
        )

        candidate.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(candidate.status, EntityCandidateStatus.ACCEPTED)
        self.assertIsNotNone(candidate.merged_into_id)
        self.assertEqual(response.json()["status"], EntityCandidateStatus.ACCEPTED)

    def test_entity_candidate_reject_action_returns_updated_candidate(self):
        candidate = EntityCandidate.objects.create(
            project=self.owner_project,
            name="Rejected Candidate",
            suggested_type="organization",
            first_seen_in=self.owner_content,
        )

        response = self.client.post(
            reverse(
                "v1:project-entity-candidate-reject",
                kwargs={"project_id": self.owner_project.id, "pk": candidate.id},
            ),
            format="json",
        )

        candidate.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(candidate.status, EntityCandidateStatus.REJECTED)
        self.assertEqual(response.json()["status"], EntityCandidateStatus.REJECTED)

    def test_entity_candidate_merge_rejects_cross_project_entity(self):
        candidate = EntityCandidate.objects.create(
            project=self.owner_project,
            name="Merge Candidate",
            suggested_type="vendor",
            first_seen_in=self.owner_content,
        )

        response = self.client.post(
            reverse(
                "v1:project-entity-candidate-merge",
                kwargs={"project_id": self.owner_project.id, "pk": candidate.id},
            ),
            {"merged_into": self.other_entity.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(response.json(), "merged_into")

    def test_entity_candidate_merge_action_returns_updated_candidate(self):
        candidate = EntityCandidate.objects.create(
            project=self.owner_project,
            name="Owner Entity Alias",
            suggested_type="vendor",
            first_seen_in=self.owner_content,
        )

        response = self.client.post(
            reverse(
                "v1:project-entity-candidate-merge",
                kwargs={"project_id": self.owner_project.id, "pk": candidate.id},
            ),
            {"merged_into": self.owner_entity.id},
            format="json",
        )

        candidate.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(candidate.status, EntityCandidateStatus.MERGED)
        self.assertEqual(candidate.merged_into_id, self.owner_entity.id)
        self.assertEqual(response.json()["merged_into"], self.owner_entity.id)

    def test_verify_bluesky_credentials_requires_project_credentials(self):
        response = self.client.post(
            reverse(
                "v1:project-verify-bluesky-credentials",
                kwargs={"id": self.owner_project.id},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "bluesky_credentials"
        )

    @patch("core.plugins.bluesky.BlueskySourcePlugin.verify_credentials")
    def test_verify_bluesky_credentials_verifies_project_account(self, verify_mock):
        credentials = BlueskyCredentials(
            project=self.owner_project, handle="project.bsky.social"
        )
        credentials.set_app_password("app-password")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-bluesky-credentials",
                kwargs={"id": self.owner_project.id},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        verify_mock.assert_called_once()
        verified_credentials = verify_mock.call_args.args[0]
        self.assertEqual(verified_credentials.id, credentials.id)
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["handle"], "project.bsky.social")
        self.assertEqual(response.json()["last_error"], "")

    @patch("core.api.logger.exception")
    @patch(
        "core.plugins.bluesky.BlueskySourcePlugin.verify_credentials",
        side_effect=RuntimeError("bad login"),
    )
    def test_verify_bluesky_credentials_surfaces_verification_errors(
        self, _verify_mock, logger_exception_mock
    ):
        credentials = BlueskyCredentials(
            project=self.owner_project, handle="project.bsky.social"
        )
        credentials.set_app_password("app-password")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-bluesky-credentials",
                kwargs={"id": self.owner_project.id},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "bluesky_credentials"
        )
        self.assertNotIn("bad login", str(response.json()))
        logger_exception_mock.assert_called_once_with(
            "Bluesky credential verification failed for project id=%s",
            self.owner_project.id,
        )

    @patch("core.signals.queue_topic_centroid_recompute")
    def test_feedback_create_assigns_current_user(self, queue_centroid_mock):
        response = self.client.post(
            reverse(
                "v1:project-feedback-list", kwargs={"project_id": self.owner_project.id}
            ),
            {
                "content": self.owner_content.id,
                "feedback_type": FeedbackType.UPVOTE,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = UserFeedback.objects.get()
        self.assertEqual(feedback.user, self.owner)
        self.assertEqual(feedback.feedback_type, FeedbackType.UPVOTE)
        queue_centroid_mock.assert_called_once_with(self.owner_project.id)

    def test_feedback_rejects_cross_project_content(self):
        response = self.client.post(
            reverse(
                "v1:project-feedback-list", kwargs={"project_id": self.owner_project.id}
            ),
            {
                "content": self.other_content.id,
                "feedback_type": FeedbackType.DOWNVOTE,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(response.json(), "content")

    def test_content_create_uses_project_from_url(self):
        response = self.client.post(
            reverse(
                "v1:project-content-list", kwargs={"project_id": self.owner_project.id}
            ),
            {
                "url": "https://example.com/new",
                "title": "New Content",
                "author": "Owner Author",
                "entity": self.owner_entity.id,
                "source_plugin": "rss",
                "published_date": "2026-04-22T00:00:00Z",
                "content_text": "Nested content text",
                "project": self.other_project.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_content = Content.objects.get(title="New Content")
        self.assertEqual(created_content.project, self.owner_project)

    @patch("core.tasks.run_relevance_scoring_skill.delay")
    def test_content_skill_action_queues_relevance_scoring(
        self, run_relevance_scoring_delay_mock
    ):

        response = self.client.post(
            f"/api/v1/projects/{self.owner_project.id}/contents/{self.owner_content.id}/skills/relevance_scoring/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        pending_result = SkillResult.objects.get(
            content=self.owner_content,
            skill_name="relevance_scoring",
            superseded_by__isnull=True,
        )
        run_relevance_scoring_delay_mock.assert_called_once_with(pending_result.id)
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
            f"/api/v1/projects/{self.owner_project.id}/contents/{self.owner_content.id}/skills/summarization/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        pending_result = SkillResult.objects.get(
            content=self.owner_content,
            skill_name="summarization",
            superseded_by__isnull=True,
        )
        run_summarization_delay_mock.assert_called_once_with(pending_result.id)
        self.assertEqual(response.json()["skill_name"], "summarization")
        self.assertEqual(response.json()["status"], SkillStatus.PENDING)

    @patch("core.pipeline.search_similar_content")
    def test_content_skill_action_runs_find_related(self, search_similar_content_mock):
        search_similar_content_mock.return_value = [
            SimpleNamespace(
                score=0.91,
                payload={
                    "content_id": self.other_content.id,
                    "title": self.other_content.title,
                    "url": self.other_content.url,
                    "published_date": self.other_content.published_date,
                    "source_plugin": self.other_content.source_plugin,
                },
            )
        ]

        response = self.client.post(
            f"/api/v1/projects/{self.owner_project.id}/contents/{self.owner_content.id}/skills/find_related/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["skill_name"], "find_related")
        self.assertEqual(response.json()["status"], SkillStatus.COMPLETED)
        self.assertEqual(
            response.json()["result_data"]["related_items"][0]["content_id"],
            self.other_content.id,
        )

    def test_authenticated_nested_list_endpoints_smoke(self):
        list_endpoints = [
            reverse(
                "v1:project-config-list", kwargs={"project_id": self.owner_project.id}
            ),
            reverse(
                "v1:project-entity-list", kwargs={"project_id": self.owner_project.id}
            ),
            reverse(
                "v1:project-entity-candidate-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            reverse(
                "v1:project-content-list", kwargs={"project_id": self.owner_project.id}
            ),
            reverse(
                "v1:project-skill-result-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            reverse(
                "v1:project-feedback-list", kwargs={"project_id": self.owner_project.id}
            ),
            reverse(
                "v1:project-ingestion-run-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            reverse(
                "v1:project-intake-allowlist-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            reverse(
                "v1:project-newsletter-intake-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            reverse(
                "v1:project-source-config-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            reverse(
                "v1:project-topic-centroid-snapshot-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            reverse(
                "v1:project-review-queue-list",
                kwargs={"project_id": self.owner_project.id},
            ),
        ]

        for endpoint in list_endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch("core.signals.queue_topic_centroid_recompute")
    def test_authenticated_nested_detail_endpoints_smoke(self, queue_centroid_mock):
        detail_endpoints = [
            reverse(
                "v1:project-config-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_config.id,
                },
            ),
            reverse(
                "v1:project-entity-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_entity.id,
                },
            ),
            reverse(
                "v1:project-content-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_content.id,
                },
            ),
            reverse(
                "v1:project-skill-result-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_skill_result.id,
                },
            ),
            reverse(
                "v1:project-ingestion-run-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_ingestion_run.id,
                },
            ),
            reverse(
                "v1:project-intake-allowlist-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_intake_allowlist.id,
                },
            ),
            reverse(
                "v1:project-newsletter-intake-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_newsletter_intake.id,
                },
            ),
            reverse(
                "v1:project-source-config-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_source_config.id,
                },
            ),
            reverse(
                "v1:project-topic-centroid-snapshot-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_topic_centroid_snapshot.id,
                },
            ),
            reverse(
                "v1:project-review-queue-detail",
                kwargs={
                    "project_id": self.owner_project.id,
                    "pk": self.owner_review_queue.id,
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
                kwargs={"project_id": self.owner_project.id, "pk": candidate.id},
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
                kwargs={"project_id": self.owner_project.id, "pk": feedback.id},
            )
        )

        credentials = BlueskyCredentials.objects.create(
            project=self.owner_project,
            handle="owner-project.bsky.social",
        )
        detail_endpoints.append(
            reverse(
                "v1:project-bluesky-credentials-detail",
                kwargs={"project_id": self.owner_project.id, "pk": credentials.id},
            )
        )

        for endpoint in detail_endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_source_config_create_validates_plugin_config(self):
        response = self.client.post(
            reverse(
                "v1:project-source-config-list",
                kwargs={"project_id": self.owner_project.id},
            ),
            {"plugin_name": SourcePluginName.RSS, "config": {}},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(response.json(), "config")
