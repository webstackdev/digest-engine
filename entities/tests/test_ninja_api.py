from __future__ import annotations

from typing import Any, cast
from unittest.mock import patch

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
    EntityCandidateEvidence,
    EntityCandidateStatus,
    EntityIdentityClaim,
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


class EntityNinjaApiTests(APITestCase):
    """Exercise entity-owned Ninja API endpoints."""

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
        _typed_client(self.client).force_login(self.owner)

    def test_entity_list_is_scoped_to_request_user_project(self):
        response = self.client.get(
            reverse(
                "ninja-api:list_entities",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(self.owner_entity))

    def test_entity_list_includes_recent_mentions_and_identity_claims(self):
        mention = EntityMention.objects.create(
            project=self.owner_project,
            content=self.owner_content,
            entity=self.owner_entity,
            role="subject",
            sentiment="neutral",
            span="Owner Entity",
            confidence=0.88,
        )
        EntityIdentityClaim.objects.create(
            entity=self.owner_entity,
            surface="linkedin",
            claim_url="https://www.linkedin.com/company/owner-entity",
            verified=True,
            verification_method="candidate_evidence",
        )

        response = self.client.get(
            reverse(
                "ninja-api:list_entities",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["mention_count"], 1)
        self.assertEqual(
            response.json()[0]["latest_mentions"][0]["id"],
            _require_pk(mention),
        )
        self.assertEqual(
            response.json()[0]["identity_claims"][0]["surface"],
            "linkedin",
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
                "ninja-api:entity_mentions",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "entity_id": _require_pk(self.owner_entity),
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response.json()[0]["id"], _require_pk(second_mention))
        self.assertEqual(response.json()[1]["id"], _require_pk(first_mention))

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
                "ninja-api:list_entities",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"ordering": "-authority_score"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["id"], _require_pk(second_entity))

    def test_entity_authority_actions_return_snapshots(self):
        EntityAuthoritySnapshot.objects.create(
            entity=self.owner_entity,
            project=self.owner_project,
            mention_component=0.6,
            engagement_component=0.35,
            recency_component=0.4,
            source_quality_component=0.45,
            cross_newsletter_component=0.25,
            feedback_component=0.5,
            duplicate_component=0.5,
            decayed_prior=0.5,
            weights_at_compute={"mention": 0.2},
            final_score=0.53,
        )
        second_snapshot = EntityAuthoritySnapshot.objects.create(
            entity=self.owner_entity,
            project=self.owner_project,
            mention_component=0.8,
            engagement_component=0.65,
            recency_component=0.7,
            source_quality_component=0.6,
            cross_newsletter_component=0.55,
            feedback_component=0.7,
            duplicate_component=0.6,
            decayed_prior=0.53,
            weights_at_compute={"engagement": 0.15},
            final_score=0.66,
        )

        components_response = self.client.get(
            reverse(
                "ninja-api:entity_authority_components",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "entity_id": _require_pk(self.owner_entity),
                },
            )
        )
        history_response = self.client.get(
            reverse(
                "ninja-api:entity_authority_history",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "entity_id": _require_pk(self.owner_entity),
                },
            ),
            {"limit": 1},
        )

        self.assertEqual(components_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            components_response.json()["weights_at_compute"]["engagement"],
            0.15,
        )
        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(history_response.json()), 1)
        self.assertEqual(history_response.json()[0]["id"], _require_pk(second_snapshot))

    def test_entity_create_uses_project_from_url(self):
        response = self.client.post(
            reverse(
                "ninja-api:create_entity",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "name": "Created Entity",
                "type": "organization",
                "project": _require_pk(self.other_project),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_entity = Entity.objects.get(name="Created Entity")
        self.assertEqual(created_entity.project, self.owner_project)

    def test_reader_cannot_delete_entity(self):
        _typed_client(self.client).force_login(self.reader)
        response = self.client.delete(
            reverse(
                "ninja-api:delete_entity",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "entity_id": _require_pk(self.owner_entity),
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_entity_candidate_list_and_actions(self):
        owner_candidate = EntityCandidate.objects.create(
            project=self.owner_project,
            name="Owner Candidate",
            suggested_type="vendor",
            first_seen_in=self.owner_content,
            cluster_key="owner-candidate-abcd1234",
            auto_promotion_blocked_reason="needs_more_occurrences",
        )
        EntityCandidateEvidence.objects.create(
            candidate=owner_candidate,
            project=self.owner_project,
            content=self.owner_content,
            source_plugin="linkedin",
            context_excerpt="Owner Candidate was cited in the article.",
            identity_surface="linkedin",
            claim_url="https://www.linkedin.com/company/owner-candidate",
        )

        list_response = self.client.get(
            reverse(
                "ninja-api:list_entity_candidates",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.json()[0]["id"], _require_pk(owner_candidate))
        self.assertEqual(list_response.json()[0]["source_plugins"], ["linkedin"])

        with patch("entities.extraction.queue_entity_identity_enrichment"):
            accept_response = self.client.post(
                f"/api/ninja/v1/projects/{_require_pk(self.owner_project)}/entity-candidates/{_require_pk(owner_candidate)}/accept/",
                format="json",
            )

        owner_candidate.refresh_from_db()
        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        self.assertEqual(owner_candidate.status, EntityCandidateStatus.ACCEPTED)
        self.assertEqual(
            accept_response.json()["status"], EntityCandidateStatus.ACCEPTED
        )

    def test_entity_candidate_reject_and_merge(self):
        reject_candidate = EntityCandidate.objects.create(
            project=self.owner_project,
            name="Rejected Candidate",
            suggested_type="organization",
            first_seen_in=self.owner_content,
        )
        reject_response = self.client.post(
            f"/api/ninja/v1/projects/{_require_pk(self.owner_project)}/entity-candidates/{_require_pk(reject_candidate)}/reject/",
            format="json",
        )
        reject_candidate.refresh_from_db()
        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reject_candidate.status, EntityCandidateStatus.REJECTED)

        merge_candidate = EntityCandidate.objects.create(
            project=self.owner_project,
            name="Merge Candidate",
            suggested_type="vendor",
            first_seen_in=self.owner_content,
        )
        invalid_merge = self.client.post(
            f"/api/ninja/v1/projects/{_require_pk(self.owner_project)}/entity-candidates/{_require_pk(merge_candidate)}/merge/",
            {"merged_into": _require_pk(self.other_entity)},
            format="json",
        )
        self.assertEqual(invalid_merge.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("merged_into", invalid_merge.json())

        with patch("entities.extraction.queue_entity_identity_enrichment"):
            valid_merge = self.client.post(
                f"/api/ninja/v1/projects/{_require_pk(self.owner_project)}/entity-candidates/{_require_pk(merge_candidate)}/merge/",
                {"merged_into": _require_pk(self.owner_entity)},
                format="json",
            )

        merge_candidate.refresh_from_db()
        self.assertEqual(valid_merge.status_code, status.HTTP_200_OK)
        self.assertEqual(merge_candidate.status, EntityCandidateStatus.MERGED)
        self.assertEqual(merge_candidate.merged_into, self.owner_entity)
