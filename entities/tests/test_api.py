from typing import Any, cast

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from content.models import Content
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityCandidateStatus,
    EntityMention,
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


class EntityApiTests(APITestCase):
    """Exercise entity-owned project API endpoints."""

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
        _typed_client(self.client).force_authenticate(self.owner)

    def assert_standardized_validation_error(
        self, payload: dict[str, object], attr: str
    ):
        """Assert the repo-standardized validation payload shape."""

        self.assertEqual(payload["type"], "validation_error")
        errors = cast(list[dict[str, object]], payload["errors"])
        self.assertTrue(any(error["attr"] == attr for error in errors))

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
        self.assertEqual(
            response.json()["merged_into"], _require_pk(self.owner_entity)
        )