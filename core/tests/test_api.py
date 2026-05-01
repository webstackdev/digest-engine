from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from core.models import (
    Content,
    ContentClusterMembership,
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
    ThemeSuggestion,
    ThemeSuggestionStatus,
    TopicCentroidSnapshot,
    TopicCluster,
    TopicVelocitySnapshot,
    UserFeedback,
)
from projects.model_support import SourcePluginName
from projects.models import (
    BlueskyCredentials,
    MastodonCredentials,
    Project,
    ProjectConfig,
    ProjectMembership,
    ProjectRole,
    SourceConfig,
)


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

    def test_project_list_requires_authentication(self):
        _typed_client(self.client).force_authenticate(user=None)

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
        self.assertEqual(response.json()[0]["id"], _require_pk(self.owner_project))
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
                kwargs={"id": _require_pk(self.owner_project)},
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
                "v1:project-entity-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(self.owner_entity))

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
                "v1:project-entity-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["mention_count"], 1)
        self.assertEqual(
            response.json()[0]["latest_mentions"][0]["id"], _require_pk(mention)
        )
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
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_entity),
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response.json()[0]["id"], _require_pk(second_mention))
        self.assertEqual(response.json()[1]["id"], _require_pk(first_mention))
        self.assertEqual(response.json()[0]["content_title"], second_content.title)

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

    def test_bluesky_credentials_list_create_and_update_hide_stored_password(self):
        list_response = self.client.get(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.json(), [])

        create_response = self.client.post(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
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
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(credentials),
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
                kwargs={"project_id": _require_pk(self.owner_project)},
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
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(
            response.json()[0]["id"], _require_pk(self.owner_newsletter_intake)
        )
        self.assertEqual(response.json()[0]["status"], NewsletterIntakeStatus.EXTRACTED)
        self.assertEqual(
            response.json()[0]["extraction_result"]["items"][0]["title"],
            "Example Post",
        )
        self.assertNotEqual(response.json()[0]["id"], _require_pk(other_intake))

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
                "v1:project-entity-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"ordering": "-authority_score"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["id"], _require_pk(second_entity))
        self.assertEqual(response.json()[1]["id"], _require_pk(self.owner_entity))

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
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(self.owner_entity),
                },
            ),
            {"limit": 1},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(second_snapshot))
        self.assertNotEqual(response.json()[0]["id"], _require_pk(first_snapshot))

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
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["project"], _require_pk(self.owner_project))
        self.assertEqual(response.json()["snapshot_count"], 2)
        self.assertEqual(response.json()["active_snapshot_count"], 2)
        self.assertEqual(
            response.json()["latest_snapshot"]["id"], _require_pk(latest_snapshot)
        )
        self.assertAlmostEqual(response.json()["avg_drift_from_previous"], 0.2)
        self.assertAlmostEqual(response.json()["avg_drift_from_week_ago"], 0.3)

    def test_topic_cluster_list_returns_current_velocity_annotation(self):
        cluster = TopicCluster.objects.create(
            project=self.owner_project,
            first_seen_at="2026-04-22T00:00:00Z",
            last_seen_at="2026-04-24T00:00:00Z",
            is_active=True,
            member_count=3,
            dominant_entity=self.owner_entity,
        )
        TopicVelocitySnapshot.objects.create(
            cluster=cluster,
            project=self.owner_project,
            window_count=4,
            trailing_mean=1.5,
            trailing_stddev=0.5,
            z_score=3.0,
            velocity_score=1.0,
        )

        response = self.client.get(
            reverse(
                "v1:project-topic-cluster-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"ordering": "-velocity_score"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(cluster))
        self.assertEqual(response.json()[0]["member_count"], 3)
        self.assertEqual(
            response.json()[0]["dominant_entity"]["id"], _require_pk(self.owner_entity)
        )
        self.assertAlmostEqual(response.json()[0]["velocity_score"], 1.0)
        self.assertAlmostEqual(response.json()[0]["z_score"], 3.0)
        self.assertEqual(response.json()[0]["window_count"], 4)

    def test_topic_cluster_detail_and_velocity_history_action_return_memberships(self):
        cluster = TopicCluster.objects.create(
            project=self.owner_project,
            first_seen_at="2026-04-22T00:00:00Z",
            last_seen_at="2026-04-24T00:00:00Z",
            is_active=True,
            member_count=1,
            dominant_entity=self.owner_entity,
        )
        ContentClusterMembership.objects.create(
            content=self.owner_content,
            cluster=cluster,
            project=self.owner_project,
            similarity=0.92,
        )
        first_snapshot = TopicVelocitySnapshot.objects.create(
            cluster=cluster,
            project=self.owner_project,
            window_count=2,
            trailing_mean=1.0,
            trailing_stddev=0.2,
            z_score=1.5,
            velocity_score=0.75,
        )
        second_snapshot = TopicVelocitySnapshot.objects.create(
            cluster=cluster,
            project=self.owner_project,
            window_count=3,
            trailing_mean=1.0,
            trailing_stddev=0.3,
            z_score=3.0,
            velocity_score=1.0,
        )
        TopicVelocitySnapshot.objects.filter(pk=first_snapshot.pk).update(
            computed_at="2026-04-23T00:00:00Z"
        )
        TopicVelocitySnapshot.objects.filter(pk=second_snapshot.pk).update(
            computed_at="2026-04-24T00:00:00Z"
        )

        detail_response = self.client.get(
            reverse(
                "v1:project-topic-cluster-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(cluster),
                },
            )
        )
        history_response = self.client.get(
            reverse(
                "v1:project-topic-cluster-velocity-history",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(cluster),
                },
            ),
            {"limit": 1},
        )

        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.json()["id"], _require_pk(cluster))
        self.assertEqual(len(detail_response.json()["memberships"]), 1)
        self.assertEqual(
            detail_response.json()["memberships"][0]["content"]["id"],
            _require_pk(self.owner_content),
        )
        self.assertEqual(len(detail_response.json()["velocity_history"]), 2)
        self.assertEqual(
            detail_response.json()["velocity_history"][0]["id"],
            _require_pk(second_snapshot),
        )

        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(history_response.json()), 1)
        self.assertEqual(history_response.json()[0]["id"], _require_pk(second_snapshot))

    def test_theme_suggestion_list_is_scoped_to_project(self):
        cluster = TopicCluster.objects.create(
            project=self.owner_project,
            first_seen_at="2026-04-22T00:00:00Z",
            last_seen_at="2026-04-24T00:00:00Z",
            is_active=True,
            member_count=3,
            dominant_entity=self.owner_entity,
        )
        suggestion = ThemeSuggestion.objects.create(
            project=self.owner_project,
            cluster=cluster,
            title="Owner Theme",
            pitch="Owner pitch",
            why_it_matters="Owner why",
            suggested_angle="Owner angle",
            velocity_at_creation=0.9,
            novelty_score=0.8,
        )
        other_cluster = TopicCluster.objects.create(
            project=self.other_project,
            first_seen_at="2026-04-22T00:00:00Z",
            last_seen_at="2026-04-24T00:00:00Z",
            is_active=True,
            member_count=3,
            dominant_entity=self.other_entity,
        )
        ThemeSuggestion.objects.create(
            project=self.other_project,
            cluster=other_cluster,
            title="Other Theme",
            pitch="Other pitch",
            why_it_matters="Other why",
            suggested_angle="Other angle",
            velocity_at_creation=0.8,
            novelty_score=0.7,
        )

        response = self.client.get(
            reverse(
                "v1:project-theme-suggestion-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(suggestion))
        self.assertEqual(response.json()[0]["status"], ThemeSuggestionStatus.PENDING)

    def test_theme_suggestion_accept_and_dismiss_actions_update_workflow_fields(self):
        cluster = TopicCluster.objects.create(
            project=self.owner_project,
            first_seen_at="2026-04-22T00:00:00Z",
            last_seen_at="2026-04-24T00:00:00Z",
            is_active=True,
            member_count=3,
            dominant_entity=self.owner_entity,
        )
        promoted_content = Content.objects.create(
            project=self.owner_project,
            url="https://example.com/promoted-by-theme",
            title="Promoted by Theme",
            author="Owner Author",
            entity=self.owner_entity,
            source_plugin=SourcePluginName.RSS,
            published_date="2026-04-24T00:00:00Z",
            content_text="Promoted content text",
        )
        ContentClusterMembership.objects.create(
            content=promoted_content,
            cluster=cluster,
            project=self.owner_project,
            similarity=0.94,
        )
        accept_suggestion = ThemeSuggestion.objects.create(
            project=self.owner_project,
            cluster=cluster,
            title="Accept Theme",
            pitch="Pitch",
            why_it_matters="Why",
            suggested_angle="Angle",
            velocity_at_creation=0.9,
            novelty_score=0.8,
        )
        dismiss_suggestion = ThemeSuggestion.objects.create(
            project=self.owner_project,
            cluster=cluster,
            title="Dismiss Theme",
            pitch="Pitch",
            why_it_matters="Why",
            suggested_angle="Angle",
            velocity_at_creation=0.7,
            novelty_score=0.75,
        )

        accept_response = self.client.post(
            reverse(
                "v1:project-theme-suggestion-accept",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(accept_suggestion),
                },
            ),
            format="json",
        )
        dismiss_response = self.client.post(
            reverse(
                "v1:project-theme-suggestion-dismiss",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(dismiss_suggestion),
                },
            ),
            {"reason": "already covered"},
            format="json",
        )

        accept_suggestion.refresh_from_db()
        dismiss_suggestion.refresh_from_db()
        promoted_content.refresh_from_db()
        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_suggestion.status, ThemeSuggestionStatus.ACCEPTED)
        self.assertEqual(accept_suggestion.decided_by, self.owner)
        self.assertIsNotNone(accept_suggestion.decided_at)
        self.assertEqual(promoted_content.newsletter_promotion_theme, accept_suggestion)
        self.assertEqual(promoted_content.newsletter_promotion_by, self.owner)
        self.assertIsNotNone(promoted_content.newsletter_promotion_at)
        self.assertEqual(len(accept_response.json()["promoted_contents"]), 1)
        self.assertEqual(
            accept_response.json()["promoted_contents"][0]["id"],
            _require_pk(promoted_content),
        )

        self.assertEqual(dismiss_response.status_code, status.HTTP_200_OK)
        self.assertEqual(dismiss_suggestion.status, ThemeSuggestionStatus.DISMISSED)
        self.assertEqual(dismiss_suggestion.dismissal_reason, "already covered")
        self.assertEqual(dismiss_suggestion.decided_by, self.owner)

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
            response.json()["newsletter_promotion_by"], _require_pk(self.owner)
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

    def test_nested_entity_list_rejects_other_users_project(self):
        response = self.client.get(
            reverse(
                "v1:project-entity-list",
                kwargs={"project_id": _require_pk(self.other_project)},
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
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(owner_candidate))

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
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(candidate),
                },
            ),
            format="json",
        )

        candidate.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(candidate.status, EntityCandidateStatus.ACCEPTED)
        self.assertIsNotNone(candidate.merged_into)
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
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(candidate),
                },
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
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(candidate),
                },
            ),
            {"merged_into": _require_pk(self.other_entity)},
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
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(candidate),
                },
            ),
            {"merged_into": _require_pk(self.owner_entity)},
            format="json",
        )

        candidate.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(candidate.status, EntityCandidateStatus.MERGED)
        self.assertEqual(candidate.merged_into, self.owner_entity)
        self.assertEqual(response.json()["merged_into"], _require_pk(self.owner_entity))

    def test_verify_bluesky_credentials_requires_project_credentials(self):
        response = self.client.post(
            reverse(
                "v1:project-verify-bluesky-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "bluesky_credentials"
        )

    @patch("ingestion.plugins.bluesky.BlueskySourcePlugin.verify_credentials")
    def test_verify_bluesky_credentials_verifies_project_account(self, verify_mock):
        credentials = BlueskyCredentials(
            project=self.owner_project, handle="project.bsky.social"
        )
        credentials.set_app_password("app-password")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-bluesky-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        verify_mock.assert_called_once()
        verified_credentials = verify_mock.call_args.args[0]
        self.assertEqual(verified_credentials, credentials)
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["handle"], "project.bsky.social")
        self.assertEqual(response.json()["last_error"], "")

    @patch("core.api.logger.exception")
    @patch(
        "ingestion.plugins.bluesky.BlueskySourcePlugin.verify_credentials",
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
                kwargs={"id": _require_pk(self.owner_project)},
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
            _require_pk(self.owner_project),
        )

    def test_verify_mastodon_credentials_requires_configured_project_credentials(self):
        response = self.client.post(
            reverse(
                "v1:project-verify-mastodon-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "mastodon_credentials"
        )

    @patch("ingestion.plugins.mastodon.MastodonSourcePlugin.verify_credentials")
    def test_verify_mastodon_credentials_verifies_project_account(self, verify_mock):
        credentials = MastodonCredentials(
            project=self.owner_project,
            instance_url="https://hachyderm.io",
            account_acct="alice@hachyderm.io",
        )
        credentials.set_access_token("access-token")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-mastodon-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        verify_mock.assert_called_once()
        verified_credentials = verify_mock.call_args.args[0]
        self.assertEqual(verified_credentials, credentials)
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["account_acct"], "alice@hachyderm.io")
        self.assertEqual(response.json()["instance_url"], "https://hachyderm.io")
        self.assertEqual(response.json()["last_error"], "")

    @patch("core.api.logger.exception")
    @patch(
        "ingestion.plugins.mastodon.MastodonSourcePlugin.verify_credentials",
        side_effect=RuntimeError("bad token"),
    )
    def test_verify_mastodon_credentials_surfaces_verification_errors(
        self, _verify_mock, logger_exception_mock
    ):
        credentials = MastodonCredentials(
            project=self.owner_project,
            instance_url="https://hachyderm.io",
            account_acct="alice@hachyderm.io",
        )
        credentials.set_access_token("access-token")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-mastodon-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "mastodon_credentials"
        )
        self.assertNotIn("bad token", str(response.json()))
        logger_exception_mock.assert_called_once_with(
            "Mastodon credential verification failed for project id=%s",
            _require_pk(self.owner_project),
        )

    @patch("core.signals.queue_topic_centroid_recompute")
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

    @patch("core.signals.queue_topic_centroid_recompute")
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

    def test_source_config_create_validates_plugin_config(self):
        response = self.client.post(
            reverse(
                "v1:project-source-config-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"plugin_name": SourcePluginName.RSS, "config": {}},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(response.json(), "config")
