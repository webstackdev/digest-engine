from types import SimpleNamespace
from typing import Any, cast

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db.models import Model
from rest_framework import serializers as drf_serializers

from content.models import Content
from content.serializers import ContentSerializer, UserFeedbackSerializer
from entities.models import Entity
from entities.serializers import EntitySerializer
from ingestion.serializers import IngestionRunSerializer
from pipeline.models import ReviewReason, SkillResult
from pipeline.serializers import ReviewQueueSerializer, SkillResultSerializer
from projects.model_support import SourcePluginName
from projects.models import (
    LinkedInCredentials,
    MastodonCredentials,
    Project,
    ProjectMembership,
    ProjectRole,
    SourceConfig,
)
from projects.serializers import (
    LinkedInCredentialsSerializer,
    MastodonCredentialsSerializer,
    ProjectSerializer,
    SourceConfigSerializer,
)

pytestmark = pytest.mark.django_db


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed serializer assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _serializer_fields(
    serializer: drf_serializers.BaseSerializer[Any],
) -> dict[str, Any]:
    """Return serializer fields with a mapping type Pylance can index."""

    return cast(dict[str, Any], cast(Any, serializer).fields)


def _serializer_data(serializer: drf_serializers.BaseSerializer[Any]) -> dict[str, Any]:
    """Return serializer output data as a dictionary for typed assertions."""

    return cast(dict[str, Any], serializer.data)


def _validated_data(
    serializer: drf_serializers.BaseSerializer[Any],
) -> dict[str, Any]:
    """Return validated serializer data as a standard dictionary."""

    return cast(dict[str, Any], serializer.validated_data)


@pytest.fixture
def serializer_context(django_user_model):
    user = django_user_model.objects.create_user(
        username="serializer-owner", password="testpass123"
    )
    other_user = django_user_model.objects.create_user(
        username="serializer-other", password="testpass123"
    )
    project = Project.objects.create(
        name="Serializer Project", topic_description="Infra"
    )
    other_project = Project.objects.create(
        name="Other Serializer Project", topic_description="Data"
    )
    ProjectMembership.objects.create(user=user, project=project, role=ProjectRole.ADMIN)
    ProjectMembership.objects.create(
        user=other_user,
        project=other_project,
        role=ProjectRole.ADMIN,
    )
    entity = Entity.objects.create(
        project=project, name="Serializer Entity", type="vendor"
    )
    other_entity = Entity.objects.create(
        project=other_project, name="Other Entity", type="vendor"
    )
    content = Content.objects.create(
        project=project,
        url="https://example.com/serializer-content",
        title="Serializer Content",
        author="Author",
        entity=entity,
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-28T00:00:00Z",
        content_text="Serializer content body.",
    )
    other_content = Content.objects.create(
        project=other_project,
        url="https://example.com/serializer-other-content",
        title="Other Content",
        author="Author",
        entity=other_entity,
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-28T00:00:00Z",
        content_text="Other serializer content body.",
    )
    skill_result = SkillResult.objects.create(
        project=project,
        content=content,
        skill_name="summarization",
        status="completed",
        result_data={"summary": "ok"},
    )
    other_skill_result = SkillResult.objects.create(
        project=other_project,
        content=other_content,
        skill_name="summarization",
        status="completed",
        result_data={"summary": "other"},
    )
    return SimpleNamespace(
        user=user,
        other_user=other_user,
        project=project,
        other_project=other_project,
        entity=entity,
        other_entity=other_entity,
        content=content,
        other_content=other_content,
        skill_result=skill_result,
        other_skill_result=other_skill_result,
    )


def _request_for(user):
    return SimpleNamespace(user=user)


def test_project_scoped_serializer_filters_related_querysets_with_project_context(
    serializer_context,
):
    serializer = SkillResultSerializer(
        context={
            "request": _request_for(serializer_context.user),
            "project": serializer_context.project,
        }
    )
    fields = _serializer_fields(serializer)

    assert list(fields["content"].queryset) == [serializer_context.content]
    assert list(fields["superseded_by"].queryset) == [serializer_context.skill_result]
    assert list(fields["project"].queryset) == [serializer_context.project]


def test_project_scoped_serializer_filters_related_querysets_without_project_context(
    serializer_context,
):
    serializer = ContentSerializer(
        context={"request": _request_for(serializer_context.user)}
    )
    fields = _serializer_fields(serializer)

    assert list(fields["entity"].queryset) == [serializer_context.entity]
    assert list(fields["project"].queryset) == [serializer_context.project]


def test_project_scoped_serializer_skips_filtering_for_anonymous_user():
    serializer = ProjectSerializer(context={"request": _request_for(AnonymousUser())})

    assert "project" not in _serializer_fields(serializer)


def test_content_serializer_rejects_cross_project_entity(serializer_context):
    serializer = ContentSerializer(
        instance=serializer_context.content,
        data={"entity": _require_pk(serializer_context.other_entity)},
        partial=True,
        context={"project": serializer_context.project},
    )

    assert serializer.is_valid() is False
    assert serializer.errors == {
        "entity": ["Entity must belong to the selected project."]
    }


def test_content_serializer_exposes_duplicate_state_as_read_only_fields(
    serializer_context,
):
    duplicate = Content.objects.create(
        project=serializer_context.project,
        url="https://example.com/serializer-content?utm_source=reddit",
        canonical_url="https://example.com/serializer-content",
        title="Serializer Duplicate",
        author="Author",
        entity=serializer_context.entity,
        source_plugin=SourcePluginName.REDDIT,
        published_date="2026-04-28T01:00:00Z",
        content_text="Duplicate serializer content body.",
        duplicate_of=serializer_context.content,
    )
    serializer_context.content.duplicate_signal_count = 1
    serializer_context.content.canonical_url = "https://example.com/serializer-content"
    serializer_context.content.save(
        update_fields=["duplicate_signal_count", "canonical_url"]
    )

    serializer = ContentSerializer(instance=duplicate)
    data = _serializer_data(serializer)

    assert data["canonical_url"] == "https://example.com/serializer-content"
    assert data["duplicate_of"] == _require_pk(serializer_context.content)
    assert data["duplicate_signal_count"] == 0


def test_content_serializer_ignores_duplicate_fields_on_update(serializer_context):
    serializer = ContentSerializer(
        instance=serializer_context.content,
        data={
            "canonical_url": "https://malicious.example/canonical",
            "duplicate_of": _require_pk(serializer_context.other_content),
            "duplicate_signal_count": 99,
        },
        partial=True,
        context={"project": serializer_context.project},
    )

    assert serializer.is_valid(), serializer.errors
    updated = cast(Content, serializer.save())

    assert updated.canonical_url == ""
    assert updated.duplicate_of is None
    assert updated.duplicate_signal_count == 0


def test_skill_result_serializer_rejects_cross_project_content(serializer_context):
    serializer = SkillResultSerializer(
        data={
            "content": _require_pk(serializer_context.other_content),
            "skill_name": "summarization",
            "status": "completed",
        },
        context={
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid() is False
    assert serializer.errors == {
        "content": ["Content must belong to the selected project."]
    }


def test_review_queue_serializer_rejects_cross_project_content(serializer_context):
    serializer = ReviewQueueSerializer(
        data={
            "content": _require_pk(serializer_context.other_content),
            "reason": ReviewReason.BORDERLINE_RELEVANCE,
            "confidence": 0.5,
        },
        context={
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid() is False
    assert serializer.errors == {
        "content": ["Content must belong to the selected project."]
    }


def test_source_config_serializer_normalizes_valid_config(serializer_context):
    serializer = SourceConfigSerializer(
        data={
            "plugin_name": SourcePluginName.RSS,
            "config": {"feed_url": "https://example.com/feed.xml"},
            "is_active": True,
        },
        context={
            "request": _request_for(serializer_context.user),
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid(), serializer.errors
    assert _validated_data(serializer)["config"] == {
        "feed_url": "https://example.com/feed.xml"
    }


def test_source_config_serializer_surfaces_plugin_validation_errors(serializer_context):
    serializer = SourceConfigSerializer(
        instance=SourceConfig(
            project=serializer_context.project,
            plugin_name=SourcePluginName.RSS,
            config={"feed_url": "https://example.com/feed.xml"},
        ),
        data={"config": {"feed_url": ""}},
        partial=True,
        context={
            "request": _request_for(serializer_context.user),
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid() is False
    assert serializer.errors == {"config": ["Invalid source configuration."]}


def test_source_config_serializer_normalizes_bluesky_author_handle_config(
    serializer_context,
):
    serializer = SourceConfigSerializer(
        data={
            "plugin_name": SourcePluginName.BLUESKY,
            "config": {"author_handle": "@Alice.BSKY.social"},
            "is_active": True,
        },
        context={
            "request": _request_for(serializer_context.user),
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid(), serializer.errors
    assert _validated_data(serializer)["config"] == {
        "author_handle": "alice.bsky.social",
        "include_replies": False,
        "max_posts_per_fetch": 100,
    }


def test_source_config_serializer_normalizes_mastodon_hashtag_config(
    serializer_context,
):
    serializer = SourceConfigSerializer(
        data={
            "plugin_name": SourcePluginName.MASTODON,
            "config": {
                "instance_url": "https://hachyderm.io/",
                "hashtag": "#PlatformEngineering",
            },
            "is_active": True,
        },
        context={
            "request": _request_for(serializer_context.user),
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid(), serializer.errors
    assert _validated_data(serializer)["config"] == {
        "instance_url": "https://hachyderm.io",
        "hashtag": "platformengineering",
        "include_replies": False,
        "include_reblogs": True,
        "max_statuses_per_fetch": 100,
    }


def test_source_config_serializer_normalizes_linkedin_organization_config(
    serializer_context,
):
    serializer = SourceConfigSerializer(
        data={
            "plugin_name": SourcePluginName.LINKEDIN,
            "config": {
                "organization_urn": "urn:li:organization:1337",
                "max_posts_per_fetch": "25",
            },
            "is_active": True,
        },
        context={
            "request": _request_for(serializer_context.user),
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid(), serializer.errors
    assert _validated_data(serializer)["config"] == {
        "organization_urn": "urn:li:organization:1337",
        "include_reshares": False,
        "max_posts_per_fetch": 25,
    }


def test_mastodon_credentials_serializer_encrypts_access_token(serializer_context):
    serializer = MastodonCredentialsSerializer(
        data={
            "instance_url": "https://hachyderm.io/",
            "account_acct": "@Alice",
            "access_token": "secret-token",
            "is_active": True,
        },
        context={
            "request": _request_for(serializer_context.user),
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid(), serializer.errors
    credentials = cast(
        MastodonCredentials,
        serializer.save(project=serializer_context.project),
    )

    assert credentials.instance_url == "https://hachyderm.io"
    assert credentials.account_acct == "alice@hachyderm.io"
    assert credentials.has_stored_credential() is True
    assert credentials.get_access_token() == "secret-token"


def test_linkedin_credentials_serializer_encrypts_oauth_tokens(serializer_context):
    serializer = LinkedInCredentialsSerializer(
        data={
            "member_urn": "urn:li:person:abc123",
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_at": "2026-04-27T13:00:00Z",
            "is_active": True,
        },
        context={
            "request": _request_for(serializer_context.user),
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid(), serializer.errors
    credentials = cast(
        LinkedInCredentials,
        serializer.save(project=serializer_context.project),
    )

    assert credentials.member_urn == "urn:li:person:abc123"
    assert credentials.has_stored_credential() is True
    assert credentials.get_access_token() == "access-token"
    assert credentials.get_refresh_token() == "refresh-token"


def test_entity_serializer_filters_project_queryset_to_request_user(serializer_context):
    serializer = EntitySerializer(
        context={"request": _request_for(serializer_context.user)}
    )

    assert list(_serializer_fields(serializer)["project"].queryset) == [
        serializer_context.project
    ]


def test_user_feedback_serializer_rejects_cross_project_content(serializer_context):
    serializer = UserFeedbackSerializer(
        data={
            "content": _require_pk(serializer_context.other_content),
            "feedback_type": "upvote",
        },
        context={
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid() is False
    assert serializer.errors == {
        "content": ["Content must belong to the selected project."]
    }


def test_review_queue_serializer_accepts_same_project_content(serializer_context):
    serializer = ReviewQueueSerializer(
        data={
            "content": _require_pk(serializer_context.content),
            "reason": ReviewReason.BORDERLINE_RELEVANCE,
            "confidence": 0.5,
        },
        context={
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid(), serializer.errors
    validated_data = cast(dict[str, Content | Any], serializer.validated_data)
    assert validated_data["content"] == serializer_context.content


def test_source_config_serializer_skips_plugin_validation_when_plugin_name_missing(
    serializer_context,
):
    serializer = SourceConfigSerializer(
        instance=SourceConfig(
            project=serializer_context.project, plugin_name="", config={}
        ),
        data={"config": {}},
        partial=True,
        context={
            "project": serializer_context.project,
        },
    )

    assert serializer.is_valid(), serializer.errors
    assert _validated_data(serializer)["config"] == {}


def test_ingestion_run_serializer_filters_project_queryset(serializer_context):
    serializer = IngestionRunSerializer(
        context={"request": _request_for(serializer_context.user)}
    )

    assert list(_serializer_fields(serializer)["project"].queryset) == [
        serializer_context.project
    ]
