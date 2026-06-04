from __future__ import annotations

from datetime import datetime, timezone
from http import HTTPStatus
from typing import Any, cast
from unittest.mock import AsyncMock, patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.test import TestCase
from django.urls import reverse

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
    TrendTaskRun,
    TrendTaskRunStatus,
)


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed API test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _create_user(user_model: type[Any], **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


class TrendsNinjaApiTests(TestCase):
    """Exercise project-scoped Ninja trends endpoints from the trends app."""

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
        self.client.force_login(self.owner)

    def test_topic_centroid_summary_returns_latest_snapshot_and_averages(self):
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
                "ninja-api:topic_centroid_snapshot_summary",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json()["project"], _require_pk(self.owner_project))
        self.assertEqual(response.json()["snapshot_count"], 2)
        self.assertEqual(response.json()["active_snapshot_count"], 2)
        self.assertEqual(
            response.json()["latest_snapshot"]["id"],
            _require_pk(self.owner_topic_centroid_snapshot),
        )
        self.assertAlmostEqual(response.json()["avg_drift_from_previous"], 0.15)
        self.assertAlmostEqual(response.json()["avg_drift_from_week_ago"], 0.25)

    def test_topic_cluster_routes_return_annotations_and_memberships(self):
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

        list_response = self.client.get(
            reverse(
                "ninja-api:list_topic_clusters",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        detail_response = self.client.get(
            reverse(
                "ninja-api:get_topic_cluster",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "cluster_id": _require_pk(cluster),
                },
            )
        )
        history_response = self.client.get(
            reverse(
                "ninja-api:topic_cluster_velocity_history",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "cluster_id": _require_pk(cluster),
                },
            ),
            {"limit": 1},
        )

        self.assertEqual(list_response.status_code, HTTPStatus.OK)
        self.assertEqual(len(list_response.json()), 1)
        self.assertEqual(list_response.json()[0]["id"], _require_pk(cluster))
        self.assertAlmostEqual(list_response.json()[0]["velocity_score"], 1.0)

        self.assertEqual(detail_response.status_code, HTTPStatus.OK)
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

        self.assertEqual(history_response.status_code, HTTPStatus.OK)
        self.assertEqual(len(history_response.json()), 1)
        self.assertEqual(history_response.json()[0]["id"], _require_pk(second_snapshot))

    def test_theme_suggestion_routes_update_workflow_fields(self):
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

        list_response = self.client.get(
            reverse(
                "ninja-api:list_theme_suggestions",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        accept_response = self.client.post(
            reverse(
                "ninja-api:accept_theme_suggestion_route",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "suggestion_id": _require_pk(accept_suggestion),
                },
            ),
        )
        dismiss_response = self.client.post(
            reverse(
                "ninja-api:dismiss_theme_suggestion_route",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "suggestion_id": _require_pk(dismiss_suggestion),
                },
            ),
            {"reason": "already covered"},
            content_type="application/json",
        )

        accept_suggestion.refresh_from_db()
        dismiss_suggestion.refresh_from_db()
        promoted_content.refresh_from_db()

        self.assertEqual(list_response.status_code, HTTPStatus.OK)
        self.assertEqual(len(list_response.json()), 2)
        self.assertEqual(
            list_response.json()[0]["status"], ThemeSuggestionStatus.PENDING
        )

        self.assertEqual(accept_response.status_code, HTTPStatus.OK)
        self.assertEqual(accept_suggestion.status, ThemeSuggestionStatus.ACCEPTED)
        self.assertEqual(accept_suggestion.decided_by, self.owner)
        self.assertIsNotNone(accept_suggestion.decided_at)
        self.assertEqual(promoted_content.newsletter_promotion_theme, accept_suggestion)
        self.assertEqual(promoted_content.newsletter_promotion_by, self.owner)
        self.assertIsNotNone(promoted_content.newsletter_promotion_at)
        self.assertEqual(len(accept_response.json()["promoted_contents"]), 1)

        self.assertEqual(dismiss_response.status_code, HTTPStatus.OK)
        self.assertEqual(dismiss_suggestion.status, ThemeSuggestionStatus.DISMISSED)
        self.assertEqual(dismiss_suggestion.dismissal_reason, "already covered")
        self.assertEqual(dismiss_suggestion.decided_by, self.owner)

    def test_original_content_idea_routes_cover_list_and_workflow_actions(self):
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

        list_response = self.client.get(
            reverse(
                "ninja-api:list_original_content_ideas",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        accept_response = self.client.post(
            reverse(
                "ninja-api:accept_original_content_idea_route",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "idea_id": _require_pk(accepted_then_written_idea),
                },
            ),
        )
        dismiss_response = self.client.post(
            reverse(
                "ninja-api:dismiss_original_content_idea_route",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "idea_id": _require_pk(dismissed_idea),
                },
            ),
            {"reason": "already assigned"},
            content_type="application/json",
        )
        mark_written_response = self.client.post(
            reverse(
                "ninja-api:mark_original_content_idea_written_route",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "idea_id": _require_pk(accepted_then_written_idea),
                },
            ),
        )

        accepted_then_written_idea.refresh_from_db()
        dismissed_idea.refresh_from_db()

        self.assertEqual(list_response.status_code, HTTPStatus.OK)
        self.assertEqual(len(list_response.json()), 2)
        self.assertEqual(
            list_response.json()[0]["status"],
            OriginalContentIdeaStatus.PENDING,
        )

        self.assertEqual(accept_response.status_code, HTTPStatus.OK)
        self.assertEqual(accept_response.json()["status"], "accepted")
        self.assertEqual(mark_written_response.status_code, HTTPStatus.OK)
        self.assertEqual(mark_written_response.json()["status"], "written")
        self.assertEqual(
            accepted_then_written_idea.status,
            OriginalContentIdeaStatus.WRITTEN,
        )
        self.assertEqual(accepted_then_written_idea.decided_by, self.owner)
        self.assertIsNotNone(accepted_then_written_idea.decided_at)

        self.assertEqual(dismiss_response.status_code, HTTPStatus.OK)
        self.assertEqual(dismissed_idea.status, OriginalContentIdeaStatus.DISMISSED)
        self.assertEqual(dismissed_idea.dismissal_reason, "already assigned")
        self.assertEqual(dismissed_idea.decided_by, self.owner)

    def test_original_content_idea_generate_route_handles_eager_and_queued_modes(self):
        with self.settings(TASKIQ_ALWAYS_EAGER=True):
            with patch(
                "trends.ninja_api.generate_original_content_ideas",
                return_value={
                    "project_id": _require_pk(self.owner_project),
                    "clusters_considered": 4,
                    "created": 2,
                    "skipped": 1,
                },
            ) as generate_mock:
                eager_response = self.client.post(
                    reverse(
                        "ninja-api:generate_original_content_ideas_route",
                        kwargs={"project_id": _require_pk(self.owner_project)},
                    ),
                )

        with self.settings(TASKIQ_ALWAYS_EAGER=False):
            with patch(
                "trends.ninja_api.generate_original_content_ideas.kiq",
                new_callable=AsyncMock,
            ) as queue_mock:
                queued_response = self.client.post(
                    reverse(
                        "ninja-api:generate_original_content_ideas_route",
                        kwargs={"project_id": _require_pk(self.owner_project)},
                    ),
                )

        self.assertEqual(eager_response.status_code, HTTPStatus.OK)
        self.assertEqual(eager_response.json()["status"], "completed")
        self.assertEqual(eager_response.json()["result"]["created"], 2)
        generate_mock.assert_called_once_with(_require_pk(self.owner_project))

        self.assertEqual(queued_response.status_code, HTTPStatus.ACCEPTED)
        self.assertEqual(queued_response.json()["status"], "queued")
        queue_mock.assert_awaited_once_with(_require_pk(self.owner_project))

    def test_source_diversity_and_trend_task_summaries_are_scoped_to_project(self):
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
        SourceDiversitySnapshot.objects.create(
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
        older_centroid_run = TrendTaskRun.objects.create(
            project=self.owner_project,
            task_name="recompute_topic_centroid",
            status=TrendTaskRunStatus.COMPLETED,
            latency_ms=140,
            summary={
                "project_id": _require_pk(self.owner_project),
                "centroid_active": True,
            },
        )
        latest_centroid_run = TrendTaskRun.objects.create(
            project=self.owner_project,
            task_name="recompute_topic_centroid",
            status=TrendTaskRunStatus.FAILED,
            latency_ms=210,
            error_message="embedding outage",
        )
        TrendTaskRun.objects.filter(pk=older_centroid_run.pk).update(
            started_at="2026-04-20T00:00:00Z"
        )
        TrendTaskRun.objects.filter(pk=latest_centroid_run.pk).update(
            started_at="2026-04-21T00:00:00Z"
        )
        source_diversity_run = TrendTaskRun.objects.create(
            project=self.owner_project,
            task_name="recompute_source_diversity",
            status=TrendTaskRunStatus.SKIPPED,
            latency_ms=18,
            summary={"project_id": _require_pk(self.owner_project), "content_count": 0},
        )

        list_response = self.client.get(
            reverse(
                "ninja-api:list_source_diversity_snapshots",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        summary_response = self.client.get(
            reverse(
                "ninja-api:source_diversity_snapshot_summary",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        task_summary_response = self.client.get(
            reverse(
                "ninja-api:trend_task_run_summary",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(list_response.status_code, HTTPStatus.OK)
        self.assertEqual(len(list_response.json()), 1)
        self.assertEqual(list_response.json()[0]["id"], _require_pk(owner_snapshot))

        self.assertEqual(summary_response.status_code, HTTPStatus.OK)
        self.assertEqual(summary_response.json()["snapshot_count"], 1)
        self.assertEqual(
            summary_response.json()["latest_snapshot"]["id"],
            _require_pk(owner_snapshot),
        )

        self.assertEqual(task_summary_response.status_code, HTTPStatus.OK)
        self.assertEqual(
            task_summary_response.json()["project"], _require_pk(self.owner_project)
        )
        self.assertEqual(task_summary_response.json()["run_count"], 3)
        self.assertEqual(task_summary_response.json()["failed_run_count"], 1)
        self.assertEqual(len(task_summary_response.json()["latest_runs"]), 2)
        self.assertEqual(
            task_summary_response.json()["latest_runs"][0]["id"],
            _require_pk(latest_centroid_run),
        )
        self.assertEqual(
            task_summary_response.json()["latest_runs"][1]["id"],
            _require_pk(source_diversity_run),
        )

    def test_trends_ninja_requires_authentication(self):
        self.client.logout()

        response = self.client.get(
            reverse(
                "ninja-api:list_topic_clusters",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, HTTPStatus.UNAUTHORIZED)
        self.assertEqual(response.json(), {"detail": "Unauthorized"})

    def test_metrics_endpoint_emits_latest_run_status_and_timestamps(self):
        older_run = TrendTaskRun.objects.create(
            project=self.owner_project,
            task_name="recompute_topic_centroid",
            status=TrendTaskRunStatus.COMPLETED,
            latency_ms=100,
            summary={"project_id": _require_pk(self.owner_project)},
        )
        latest_run = TrendTaskRun.objects.create(
            project=self.owner_project,
            task_name="recompute_topic_centroid",
            status=TrendTaskRunStatus.FAILED,
            latency_ms=250,
            error_message="boom",
            summary={"project_id": _require_pk(self.owner_project)},
        )
        older_started_at = datetime(2026, 4, 20, 8, 0, tzinfo=timezone.utc)
        latest_started_at = datetime(2026, 4, 21, 8, 0, tzinfo=timezone.utc)
        latest_finished_at = datetime(2026, 4, 21, 8, 0, 1, tzinfo=timezone.utc)
        TrendTaskRun.objects.filter(pk=older_run.pk).update(started_at=older_started_at)
        TrendTaskRun.objects.filter(pk=latest_run.pk).update(
            started_at=latest_started_at,
            finished_at=latest_finished_at,
        )

        with self.settings(METRICS_TOKEN="metrics-secret"):
            response = self.client.get(
                reverse("metrics"),
                HTTP_AUTHORIZATION="Bearer metrics-secret",
            )

        response_body = response.content.decode("utf-8")
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertIn(
            'newsletter_trend_task_run_latest_status{project_id="1",task_name="recompute_topic_centroid",status="failed"} 1',
            response_body,
        )
        self.assertIn(
            'newsletter_trend_task_run_latest_latency_ms{project_id="1",task_name="recompute_topic_centroid"} 250',
            response_body,
        )
        self.assertIn(
            "newsletter_trend_task_run_latest_started_timestamp_seconds"
            f'{{project_id="1",task_name="recompute_topic_centroid"}} {latest_started_at.timestamp():.6f}',
            response_body,
        )
        self.assertIn(
            "newsletter_trend_task_run_latest_finished_timestamp_seconds"
            f'{{project_id="1",task_name="recompute_topic_centroid"}} {latest_finished_at.timestamp():.6f}',
            response_body,
        )
