from typing import Any, cast

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from content.models import Content
from entities.models import Entity
from projects.model_support import SourcePluginName
from projects.models import Project, ProjectConfig, ProjectMembership, ProjectRole
from trends.models import (
    ContentClusterMembership,
    OriginalContentIdea,
    OriginalContentIdeaStatus,
    SourceDiversitySnapshot,
    ThemeSuggestion,
    ThemeSuggestionStatus,
    TopicCentroidSnapshot,
    TopicCluster,
    TopicVelocitySnapshot,
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


class TrendsApiTests(APITestCase):
    """Exercise project-scoped trends API endpoints from the trends app."""

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
        ProjectConfig.objects.create(project=self.owner_project)
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

    def test_topic_centroid_summary_action_returns_latest_snapshot_and_averages(self):
        older_snapshot = TopicCentroidSnapshot.objects.create(
            project=self.owner_project,
            centroid_active=True,
            centroid_vector=[0.0, 1.0],
            feedback_count=8,
            upvote_count=6,
            downvote_count=2,
            drift_from_previous=0.2,
            drift_from_week_ago=0.3,
        )
        TopicCentroidSnapshot.objects.filter(pk=older_snapshot.pk).update(
            computed_at="2026-04-20T00:00:00Z"
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
            response.json()["latest_snapshot"]["id"],
            _require_pk(self.owner_topic_centroid_snapshot),
        )
        self.assertAlmostEqual(response.json()["avg_drift_from_previous"], 0.15)
        self.assertAlmostEqual(response.json()["avg_drift_from_week_ago"], 0.25)

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
            window_count=3,
            trailing_mean=1.0,
            trailing_stddev=0.5,
            z_score=2.0,
            velocity_score=0.9,
        )

        response = self.client.get(
            reverse(
                "v1:project-topic-cluster-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(cluster))
        self.assertAlmostEqual(response.json()[0]["velocity_score"], 0.9)

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

    def test_original_content_idea_list_is_scoped_to_project(self):
        cluster = TopicCluster.objects.create(
            project=self.owner_project,
            first_seen_at="2026-04-22T00:00:00Z",
            last_seen_at="2026-04-24T00:00:00Z",
            is_active=True,
            member_count=3,
            dominant_entity=self.owner_entity,
            label="Owner Cluster",
        )
        idea = OriginalContentIdea.objects.create(
            project=self.owner_project,
            related_cluster=cluster,
            angle_title="Owner idea",
            summary="Owner summary",
            suggested_outline="Owner outline",
            why_now="Owner why now",
            generated_by_model="heuristic",
            self_critique_score=0.82,
        )
        idea.supporting_contents.add(self.owner_content)

        other_cluster = TopicCluster.objects.create(
            project=self.other_project,
            first_seen_at="2026-04-22T00:00:00Z",
            last_seen_at="2026-04-24T00:00:00Z",
            is_active=True,
            member_count=2,
            dominant_entity=self.other_entity,
            label="Other Cluster",
        )
        other_idea = OriginalContentIdea.objects.create(
            project=self.other_project,
            related_cluster=other_cluster,
            angle_title="Other idea",
            summary="Other summary",
            suggested_outline="Other outline",
            why_now="Other why now",
            generated_by_model="heuristic",
            self_critique_score=0.7,
        )
        other_idea.supporting_contents.add(self.other_content)

        response = self.client.get(
            reverse(
                "v1:project-original-content-idea-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(idea))
        self.assertEqual(
            response.json()[0]["status"], OriginalContentIdeaStatus.PENDING
        )
        self.assertEqual(
            response.json()[0]["related_cluster"]["id"], _require_pk(cluster)
        )
        self.assertEqual(len(response.json()[0]["supporting_contents"]), 1)
        self.assertEqual(
            response.json()[0]["supporting_contents"][0]["id"],
            _require_pk(self.owner_content),
        )

    def test_original_content_idea_workflow_actions_update_status_fields(self):
        cluster = TopicCluster.objects.create(
            project=self.owner_project,
            first_seen_at="2026-04-22T00:00:00Z",
            last_seen_at="2026-04-24T00:00:00Z",
            is_active=True,
            member_count=3,
            dominant_entity=self.owner_entity,
            label="Idea Cluster",
        )
        accepted_then_written_idea = OriginalContentIdea.objects.create(
            project=self.owner_project,
            related_cluster=cluster,
            angle_title="Accept me",
            summary="Summary",
            suggested_outline="Outline",
            why_now="Why now",
            generated_by_model="heuristic",
            self_critique_score=0.8,
        )
        accepted_then_written_idea.supporting_contents.add(self.owner_content)
        dismissed_idea = OriginalContentIdea.objects.create(
            project=self.owner_project,
            related_cluster=cluster,
            angle_title="Dismiss me",
            summary="Summary",
            suggested_outline="Outline",
            why_now="Why now",
            generated_by_model="heuristic",
            self_critique_score=0.75,
        )

        accept_response = self.client.post(
            reverse(
                "v1:project-original-content-idea-accept",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(accepted_then_written_idea),
                },
            ),
            format="json",
        )
        dismiss_response = self.client.post(
            reverse(
                "v1:project-original-content-idea-dismiss",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(dismissed_idea),
                },
            ),
            {"reason": "already assigned"},
            format="json",
        )
        mark_written_response = self.client.post(
            reverse(
                "v1:project-original-content-idea-mark-written",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(accepted_then_written_idea),
                },
            ),
            format="json",
        )

        accepted_then_written_idea.refresh_from_db()
        dismissed_idea.refresh_from_db()

        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_response.json()["status"], "accepted")
        self.assertEqual(
            mark_written_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(mark_written_response.json()["status"], "written")
        self.assertEqual(
            accepted_then_written_idea.status,
            OriginalContentIdeaStatus.WRITTEN,
        )
        self.assertEqual(accepted_then_written_idea.decided_by, self.owner)
        self.assertIsNotNone(accepted_then_written_idea.decided_at)

        self.assertEqual(dismiss_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            dismissed_idea.status,
            OriginalContentIdeaStatus.DISMISSED,
        )
        self.assertEqual(dismissed_idea.dismissal_reason, "already assigned")
        self.assertEqual(dismissed_idea.decided_by, self.owner)

    def test_original_content_idea_generate_action_runs_immediately_in_eager_mode(
        self,
    ):
        with self.settings(CELERY_TASK_ALWAYS_EAGER=True):
            with self.subTest("generate now returns completed result"):
                from unittest.mock import patch

                with patch(
                    "trends.api.generate_original_content_ideas",
                    return_value={
                        "project_id": _require_pk(self.owner_project),
                        "clusters_considered": 4,
                        "created": 2,
                        "skipped": 1,
                    },
                ) as generate_mock:
                    response = self.client.post(
                        reverse(
                            "v1:project-original-content-idea-generate",
                            kwargs={"project_id": _require_pk(self.owner_project)},
                        ),
                        format="json",
                    )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "completed")
        self.assertEqual(response.json()["project_id"], _require_pk(self.owner_project))
        self.assertEqual(response.json()["result"]["created"], 2)
        generate_mock.assert_called_once_with(_require_pk(self.owner_project))

    def test_original_content_idea_generate_action_queues_in_background_mode(self):
        with self.settings(CELERY_TASK_ALWAYS_EAGER=False):
            from unittest.mock import patch

            with patch(
                "trends.api.generate_original_content_ideas.delay"
            ) as delay_mock:
                response = self.client.post(
                    reverse(
                        "v1:project-original-content-idea-generate",
                        kwargs={"project_id": _require_pk(self.owner_project)},
                    ),
                    format="json",
                )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.json()["status"], "queued")
        self.assertEqual(response.json()["project_id"], _require_pk(self.owner_project))
        delay_mock.assert_called_once_with(_require_pk(self.owner_project))

    def test_source_diversity_snapshot_list_and_summary_are_scoped_to_project(self):
        owner_snapshot = SourceDiversitySnapshot.objects.create(
            project=self.owner_project,
            window_days=14,
            plugin_entropy=0.8,
            source_entropy=0.75,
            author_entropy=0.5,
            cluster_entropy=0.6,
            top_plugin_share=0.7,
            top_source_share=0.65,
            breakdown={
                "total_content_count": 4,
                "plugin_counts": [],
                "source_counts": [],
                "author_counts": [],
                "cluster_counts": [],
                "alerts": [],
            },
        )
        other_snapshot = SourceDiversitySnapshot.objects.create(
            project=self.other_project,
            window_days=14,
            plugin_entropy=0.2,
            source_entropy=0.3,
            author_entropy=0.1,
            cluster_entropy=0.4,
            top_plugin_share=0.95,
            top_source_share=0.95,
            breakdown={
                "total_content_count": 8,
                "plugin_counts": [],
                "source_counts": [],
                "author_counts": [],
                "cluster_counts": [],
                "alerts": [],
            },
        )

        list_response = self.client.get(
            reverse(
                "v1:project-source-diversity-snapshot-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        summary_response = self.client.get(
            reverse(
                "v1:project-source-diversity-snapshot-summary",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.json()), 1)
        self.assertEqual(list_response.json()[0]["id"], _require_pk(owner_snapshot))
        self.assertNotEqual(_require_pk(owner_snapshot), _require_pk(other_snapshot))

        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            summary_response.json()["project"], _require_pk(self.owner_project)
        )
        self.assertEqual(summary_response.json()["snapshot_count"], 1)
        self.assertEqual(
            summary_response.json()["latest_snapshot"]["id"],
            _require_pk(owner_snapshot),
        )
