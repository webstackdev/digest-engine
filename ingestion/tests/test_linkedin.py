from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from django.utils import timezone

from entities.models import Entity
from ingestion.plugins.base import ContentItem
from ingestion.plugins.linkedin import LinkedInSourcePlugin
from projects.model_support import SourcePluginName
from projects.models import LinkedInCredentials, Project, SourceConfig

pytestmark = pytest.mark.django_db


@pytest.fixture
def linkedin_context():
    project = Project.objects.create(name="LinkedIn Project", topic_description="Infra")
    entity = Entity.objects.create(
        project=project,
        name="Alice",
        type="individual",
        linkedin_url="https://www.linkedin.com/in/alice-example/",
        website_url="https://example.com/company",
    )
    source_config = SourceConfig.objects.create(
        project=project,
        plugin_name=SourcePluginName.LINKEDIN,
        config={"person_urn": "urn:li:person:abc123"},
    )
    return SimpleNamespace(project=project, entity=entity, source_config=source_config)


def test_linkedin_validate_config_normalizes_defaults_and_rejects_invalid_values():
    assert LinkedInSourcePlugin.validate_config(
        {"organization_urn": "urn:li:organization:1337"}
    ) == {
        "organization_urn": "urn:li:organization:1337",
        "include_reshares": False,
        "max_posts_per_fetch": 50,
    }

    assert LinkedInSourcePlugin.validate_config(
        {
            "person_urn": "urn:li:person:abc123",
            "include_reshares": True,
            "max_posts_per_fetch": "10",
        }
    ) == {
        "person_urn": "urn:li:person:abc123",
        "include_reshares": True,
        "max_posts_per_fetch": 10,
    }

    with pytest.raises(ValueError, match="Provide at least one"):
        LinkedInSourcePlugin.validate_config({})

    with pytest.raises(ValueError, match="LinkedIn URNs must start"):
        LinkedInSourcePlugin.validate_config({"organization_urn": "1337"})

    with pytest.raises(
        ValueError, match="max_posts_per_fetch must be a positive integer"
    ):
        LinkedInSourcePlugin.validate_config(
            {"organization_urn": "urn:li:organization:1337", "max_posts_per_fetch": 0}
        )

    with pytest.raises(ValueError, match="include_reshares must be a boolean"):
        LinkedInSourcePlugin.validate_config(
            {"organization_urn": "urn:li:organization:1337", "include_reshares": "yes"}
        )


def test_linkedin_fetch_new_content_prefers_embedded_articles_and_dedupes_posts(
    linkedin_context, mocker
):
    plugin = LinkedInSourcePlugin(linkedin_context.source_config)
    now = datetime.now(tz=UTC)
    old_post = {
        "id": "urn:li:share:old",
        "published_at": (now - timedelta(days=2)).isoformat(),
        "commentary": {"text": "Old post"},
    }
    fresh_post = {
        "id": "urn:li:share:fresh",
        "published_at": now.isoformat(),
        "commentary": {"text": "Check this out"},
        "author": {
            "urn": "urn:li:person:abc123",
            "display_name": "Alice Example",
            "profile_url": "https://www.linkedin.com/in/alice-example/",
        },
        "content": {"article": {"url": "https://example.com/article"}},
        "engagement": {"likes": 3, "comments": 2, "shares": 1},
    }
    duplicate_post = dict(fresh_post)
    mocker.patch.object(
        LinkedInSourcePlugin,
        "_get_posts",
        return_value=[old_post, fresh_post, duplicate_post],
    )

    items = plugin.fetch_new_content(since=now - timedelta(hours=1))

    assert len(items) == 1
    assert items[0].url == "https://example.com/article"
    assert items[0].title == "Check this out"
    assert items[0].author == "Alice Example"
    assert items[0].content_text == "Check this out"
    assert items[0].content_type == "article"
    assert items[0].source_plugin == SourcePluginName.LINKEDIN
    assert items[0].source_metadata == {
        "author_display_name": "Alice Example",
        "author_profile_url": "https://www.linkedin.com/in/alice-example",
        "author_urn": "urn:li:person:abc123",
        "comment_count": 2,
        "embedded_url": "https://example.com/article",
        "like_count": 3,
        "post_urn": "urn:li:share:fresh",
        "share_count": 1,
    }


def test_linkedin_match_entity_for_item_uses_linkedin_profile_url(linkedin_context):
    plugin = LinkedInSourcePlugin(linkedin_context.source_config)

    result = plugin.match_entity_for_item(
        ContentItem(
            url="https://irrelevant.example.com/article",
            title="Ignored title",
            author="Alice Example",
            published_date=datetime.now(tz=UTC),
            content_text="Ignored body",
            source_plugin=SourcePluginName.LINKEDIN,
            source_metadata={
                "author_profile_url": "https://www.linkedin.com/in/alice-example/"
            },
        )
    )

    assert result == linkedin_context.entity


def test_linkedin_health_check_queries_configured_endpoint(linkedin_context, mocker):
    credentials = LinkedInCredentials(project=linkedin_context.project)
    credentials.set_access_token("access-token")
    credentials.set_refresh_token("refresh-token")
    credentials.expires_at = timezone.now() + timedelta(days=2)
    credentials.save()
    get_posts_mock = mocker.patch.object(
        LinkedInSourcePlugin, "_get_posts", return_value=[]
    )

    plugin = LinkedInSourcePlugin(linkedin_context.source_config)

    assert plugin.health_check() is True
    get_posts_mock.assert_called_once_with(limit=1)


def test_linkedin_verify_credentials_updates_member_urn(linkedin_context, mocker):
    credentials = LinkedInCredentials(project=linkedin_context.project)
    credentials.set_access_token("access-token")
    credentials.set_refresh_token("refresh-token")
    credentials.save()
    request_mock = mocker.patch.object(
        LinkedInSourcePlugin,
        "_request_json",
        return_value={"id": "abc123"},
    )

    LinkedInSourcePlugin.verify_credentials(credentials)

    request_mock.assert_called_once()
    credentials.refresh_from_db()
    assert credentials.member_urn == "urn:li:person:abc123"
    assert credentials.last_error == ""
    assert credentials.last_verified_at is not None


def test_linkedin_refresh_credentials_updates_encrypted_tokens(
    linkedin_context, mocker
):
    credentials = LinkedInCredentials(project=linkedin_context.project)
    credentials.set_access_token("stale-access-token")
    credentials.set_refresh_token("refresh-token")
    credentials.save()
    response = mocker.Mock()
    response.json.return_value = {
        "access_token": "fresh-access-token",
        "refresh_token": "fresh-refresh-token",
        "expires_in": 3600,
    }
    response.raise_for_status.return_value = None
    requests_post_mock = mocker.patch(
        "ingestion.plugins.linkedin.requests.post",
        return_value=response,
    )
    mocker.patch("ingestion.plugins.linkedin.settings.LINKEDIN_CLIENT_ID", "client-id")
    mocker.patch(
        "ingestion.plugins.linkedin.settings.LINKEDIN_CLIENT_SECRET", "client-secret"
    )

    LinkedInSourcePlugin.refresh_credentials(credentials)

    requests_post_mock.assert_called_once()
    credentials.refresh_from_db()
    assert credentials.get_access_token() == "fresh-access-token"
    assert credentials.get_refresh_token() == "fresh-refresh-token"
    assert credentials.expires_at is not None
