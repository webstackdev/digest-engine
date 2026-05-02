from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import Mock

import pytest
from django.contrib.admin.sites import AdminSite
from django.db.models import Model
from django.http import HttpRequest
from django.test import RequestFactory
from django.utils import timezone

from content.models import Content
from entities.admin import (
    EntityAdmin,
    EntityAuthoritySnapshotAdmin,
    EntityCandidateAdmin,
)
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityCandidateStatus,
    EntityMention,
)
from projects.model_support import SourcePluginName
from projects.models import Project

pytestmark = pytest.mark.django_db


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed admin test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _create_user(user_model: Any, **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


def _request(query_params: dict[str, str] | None = None) -> HttpRequest:
    """Build a typed request object for admin actions and filters."""

    return RequestFactory().get("/admin/", data=query_params or {})


def _message_user_mock(admin_instance: Any, mocker: Any) -> Mock:
    """Install a mock for ModelAdmin.message_user and return it for assertions."""

    message_mock = cast(Mock, mocker.Mock())
    admin_instance.message_user = message_mock
    return message_mock


@pytest.fixture
def source_admin_context(django_user_model):
    user = _create_user(
        django_user_model, username="admin-owner", password="testpass123"
    )
    project = Project.objects.create(name="Admin Project", topic_description="Infra")
    return SimpleNamespace(user=user, project=project)


@pytest.mark.parametrize(
    ("authority_score", "expected_color", "expected_display"),
    [
        (0.9, "green", "90.0%"),
        (0.6, "orange", "60.0%"),
        (0.2, "red", "20.0%"),
    ],
)
def test_entity_colored_score_uses_expected_color(
    source_admin_context, authority_score, expected_color, expected_display
):
    entity = Entity.objects.create(
        project=source_admin_context.project,
        name=f"Entity {authority_score}",
        type="vendor",
        authority_score=authority_score,
        website_url=f"https://entity-{authority_score}.example.com",
    )
    admin_instance = EntityAdmin(Entity, AdminSite())

    rendered = admin_instance.colored_score(entity)

    assert expected_color in rendered
    assert expected_display in rendered


def test_entity_admin_latest_snapshot_summary_renders_components(source_admin_context):
    entity = Entity.objects.create(
        project=source_admin_context.project,
        name="Snapshot Entity",
        type="vendor",
        authority_score=0.73,
    )
    EntityAuthoritySnapshot.objects.create(
        entity=entity,
        project=source_admin_context.project,
        mention_component=0.7,
        feedback_component=0.55,
        duplicate_component=0.4,
        decayed_prior=0.5,
        final_score=0.73,
    )
    admin_instance = EntityAdmin(Entity, AdminSite())

    rendered = admin_instance.latest_snapshot_summary(entity)

    assert "M 70.0%" in rendered
    assert "F 55.0%" in rendered
    assert "D 40.0%" in rendered
    assert "Carry 50.0%" in rendered


def test_entity_authority_snapshot_admin_helpers_render_expected_values(
    source_admin_context,
):
    entity = Entity.objects.create(
        project=source_admin_context.project,
        name="Snapshot Admin Entity",
        type="vendor",
        authority_score=0.81,
    )
    snapshot = EntityAuthoritySnapshot.objects.create(
        entity=entity,
        project=source_admin_context.project,
        mention_component=0.8,
        feedback_component=0.6,
        duplicate_component=0.4,
        decayed_prior=0.5,
        final_score=0.81,
    )
    admin_instance = EntityAuthoritySnapshotAdmin(EntityAuthoritySnapshot, AdminSite())

    rendered_score = admin_instance.display_final_score(snapshot)
    rendered_components = admin_instance.display_components(snapshot)

    assert "81.0%" in rendered_score
    assert "green" in rendered_score
    assert "M 80.0%" in rendered_components
    assert "F 60.0%" in rendered_components


def test_accept_selected_entity_candidates_creates_entity_and_backfills_mentions(
    source_admin_context, mocker
):
    mocker.patch("entities.extraction.queue_entity_identity_enrichment")
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/river-labs-launch",
        title="River Labs ships a new platform release",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="River Labs announced a new hosted control plane.",
    )
    candidate = EntityCandidate.objects.create(
        project=source_admin_context.project,
        name="River Labs",
        suggested_type="vendor",
        first_seen_in=content,
        occurrence_count=2,
    )
    admin_instance = EntityCandidateAdmin(EntityCandidate, AdminSite())
    _message_user_mock(admin_instance, mocker)

    admin_instance.accept_selected_candidates(
        request=_request(),
        queryset=EntityCandidate.objects.filter(pk=candidate.pk),
    )

    candidate.refresh_from_db()
    content.refresh_from_db()
    entity = Entity.objects.get(
        project=source_admin_context.project,
        name="River Labs",
    )
    mention = EntityMention.objects.get(content=content, entity=entity)

    assert candidate.status == EntityCandidateStatus.ACCEPTED
    assert candidate.merged_into == entity
    assert mention.role == "subject"
    assert content.entity == entity


def test_reject_selected_entity_candidates_marks_candidates_rejected(
    source_admin_context, mocker
):
    candidate = EntityCandidate.objects.create(
        project=source_admin_context.project,
        name="Rejected Vendor",
        suggested_type="vendor",
    )
    admin_instance = EntityCandidateAdmin(EntityCandidate, AdminSite())
    _message_user_mock(admin_instance, mocker)

    admin_instance.reject_selected_candidates(
        request=_request(),
        queryset=EntityCandidate.objects.filter(pk=candidate.pk),
    )

    candidate.refresh_from_db()

    assert candidate.status == EntityCandidateStatus.REJECTED


def test_merge_selected_entity_candidates_uses_existing_same_name_entity(
    source_admin_context, mocker
):
    mocker.patch("entities.extraction.queue_entity_identity_enrichment")
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/acme-merge",
        title="Acme ships a new platform feature",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Acme expanded its hosted platform product.",
    )
    entity = Entity.objects.create(
        project=source_admin_context.project,
        name="Acme",
        type="vendor",
    )
    candidate = EntityCandidate.objects.create(
        project=source_admin_context.project,
        name="Acme",
        suggested_type="vendor",
        first_seen_in=content,
    )
    admin_instance = EntityCandidateAdmin(EntityCandidate, AdminSite())
    _message_user_mock(admin_instance, mocker)

    admin_instance.merge_into_existing_entities(
        request=_request(),
        queryset=EntityCandidate.objects.filter(pk=candidate.pk),
    )

    candidate.refresh_from_db()

    assert candidate.status == EntityCandidateStatus.MERGED
    assert candidate.merged_into == entity
