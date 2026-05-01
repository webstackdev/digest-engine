from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from core.models import Entity
from core.plugins.mastodon import MastodonSourcePlugin
from ingestion.plugins.base import ContentItem
from projects.model_support import SourcePluginName
from projects.models import MastodonCredentials, Project, SourceConfig

pytestmark = pytest.mark.django_db


@pytest.fixture
def mastodon_context():
    project = Project.objects.create(name="Mastodon Project", topic_description="Infra")
    entity = Entity.objects.create(
        project=project,
        name="Alice",
        type="person",
        mastodon_handle="@alice@hachyderm.io",
        website_url="https://example.com/company",
    )
    source_config = SourceConfig.objects.create(
        project=project,
        plugin_name=SourcePluginName.MASTODON,
        config={
            "instance_url": "https://hachyderm.io",
            "hashtag": "platformengineering",
        },
    )
    return SimpleNamespace(project=project, entity=entity, source_config=source_config)


def test_mastodon_validate_config_normalizes_defaults_and_rejects_invalid_values():
    assert MastodonSourcePlugin.validate_config(
        {"instance_url": "https://hachyderm.io/", "hashtag": "#PlatformEngineering"}
    ) == {
        "instance_url": "https://hachyderm.io",
        "hashtag": "platformengineering",
        "max_statuses_per_fetch": 100,
        "include_replies": False,
        "include_reblogs": True,
    }

    assert MastodonSourcePlugin.validate_config(
        {
            "instance_url": "https://mastodon.social",
            "account_acct": "@Alice",
            "max_statuses_per_fetch": "5",
            "include_replies": True,
            "include_reblogs": False,
        }
    ) == {
        "instance_url": "https://mastodon.social",
        "account_acct": "alice@mastodon.social",
        "max_statuses_per_fetch": 5,
        "include_replies": True,
        "include_reblogs": False,
    }

    assert MastodonSourcePlugin.validate_config(
        {"instance_url": "https://hachyderm.io", "list_id": "42"}
    ) == {
        "instance_url": "https://hachyderm.io",
        "list_id": 42,
        "max_statuses_per_fetch": 100,
        "include_replies": False,
        "include_reblogs": True,
    }

    with pytest.raises(ValueError, match="Provide exactly one"):
        MastodonSourcePlugin.validate_config({"instance_url": "https://hachyderm.io"})

    with pytest.raises(ValueError, match="Provide exactly one"):
        MastodonSourcePlugin.validate_config(
            {"hashtag": "ai", "account_acct": "alice@hachyderm.io"}
        )

    with pytest.raises(
        ValueError, match="max_statuses_per_fetch must be a positive integer"
    ):
        MastodonSourcePlugin.validate_config(
            {"hashtag": "ai", "max_statuses_per_fetch": 0}
        )

    with pytest.raises(ValueError, match="include_replies must be a boolean"):
        MastodonSourcePlugin.validate_config(
            {"hashtag": "ai", "include_replies": "yes"}
        )


def test_mastodon_fetch_new_content_prefers_card_urls_and_dedupes_statuses(
    mastodon_context, mocker
):
    plugin = MastodonSourcePlugin(mastodon_context.source_config)
    now = datetime.now(tz=UTC)
    old_status = {
        "uri": "https://hachyderm.io/users/alice/statuses/old",
        "url": "https://hachyderm.io/@alice/old",
        "created_at": now - timedelta(days=2),
        "account": {
            "acct": "alice",
            "username": "alice",
            "display_name": "Alice Example",
            "url": "https://hachyderm.io/@alice",
        },
        "content": "<p>Old post</p>",
        "replies_count": 0,
        "reblogs_count": 0,
        "favourites_count": 0,
    }
    fresh_status = {
        "uri": "https://hachyderm.io/users/alice/statuses/fresh",
        "url": "https://hachyderm.io/@alice/fresh",
        "created_at": now,
        "account": {
            "acct": "alice",
            "username": "alice",
            "display_name": "Alice Example",
            "url": "https://hachyderm.io/@alice",
        },
        "content": "<p>Check this out</p>",
        "card": {
            "url": "https://example.com/article",
            "title": "Linked article",
        },
        "replies_count": 1,
        "reblogs_count": 2,
        "favourites_count": 3,
    }
    duplicate_status = dict(fresh_status)
    mocker.patch.object(
        MastodonSourcePlugin,
        "_get_statuses",
        return_value=[old_status, fresh_status, duplicate_status],
    )

    items = plugin.fetch_new_content(since=now - timedelta(hours=1))

    assert len(items) == 1
    assert items[0].url == "https://example.com/article"
    assert items[0].title == "Linked article"
    assert items[0].author == "Alice Example"
    assert items[0].content_text == "Check this out"
    assert items[0].source_plugin == SourcePluginName.MASTODON
    assert items[0].source_metadata == {
        "author_acct": "alice@hachyderm.io",
        "author_display_name": "Alice Example",
        "embedded_url": "https://example.com/article",
        "instance_url": "https://hachyderm.io",
        "favorite_count": 3,
        "reblog_count": 2,
        "reply_count": 1,
        "status_uri": "https://hachyderm.io/users/alice/statuses/fresh",
        "status_url": "https://hachyderm.io/@alice/fresh",
    }


def test_mastodon_match_entity_for_item_uses_mastodon_handle(mastodon_context):
    plugin = MastodonSourcePlugin(mastodon_context.source_config)

    result = plugin.match_entity_for_item(
        ContentItem(
            url="https://irrelevant.example.com/article",
            title="Ignored title",
            author="Alice Example",
            published_date=datetime.now(tz=UTC),
            content_text="Ignored body",
            source_plugin=SourcePluginName.MASTODON,
            source_metadata={"author_acct": "Alice@Hachyderm.io"},
        )
    )

    assert result == mastodon_context.entity


def test_mastodon_health_check_queries_configured_hashtag_endpoint(
    mastodon_context, mocker
):
    client = SimpleNamespace(
        timeline_hashtag=mocker.Mock(return_value=[]),
        ratelimit_remaining=None,
        ratelimit_reset=None,
    )
    mocker.patch.object(MastodonSourcePlugin, "_client", return_value=client)

    plugin = MastodonSourcePlugin(mastodon_context.source_config)

    assert plugin.health_check() is True
    client.timeline_hashtag.assert_called_once_with("platformengineering", limit=1)


def test_mastodon_get_statuses_uses_account_timeline_lookup(mastodon_context, mocker):
    mastodon_context.source_config.config = {
        "instance_url": "https://hachyderm.io",
        "account_acct": "alice@hachyderm.io",
        "include_replies": False,
        "include_reblogs": True,
        "max_statuses_per_fetch": 100,
    }
    client = SimpleNamespace(
        account_lookup=mocker.Mock(return_value={"id": 7}),
        account_statuses=mocker.Mock(return_value=[]),
        ratelimit_remaining=None,
        ratelimit_reset=None,
    )
    mocker.patch.object(MastodonSourcePlugin, "_client", return_value=client)

    plugin = MastodonSourcePlugin(mastodon_context.source_config)
    plugin._get_statuses()

    client.account_lookup.assert_called_once_with("alice@hachyderm.io")
    client.account_statuses.assert_called_once_with(
        7,
        limit=100,
        exclude_replies=True,
        exclude_reblogs=False,
    )


def test_mastodon_get_statuses_uses_list_timeline(mastodon_context, mocker):
    mastodon_context.source_config.config = {
        "instance_url": "https://hachyderm.io",
        "list_id": 42,
        "include_replies": False,
        "include_reblogs": True,
        "max_statuses_per_fetch": 100,
    }
    client = SimpleNamespace(
        timeline_list=mocker.Mock(return_value=[]),
        ratelimit_remaining=None,
        ratelimit_reset=None,
    )
    mocker.patch.object(MastodonSourcePlugin, "_client", return_value=client)

    plugin = MastodonSourcePlugin(mastodon_context.source_config)
    plugin._get_statuses()

    client.timeline_list.assert_called_once_with(42, limit=100)


def test_mastodon_credentials_encrypt_token_and_normalize_fields(mastodon_context):
    credentials = MastodonCredentials(
        project=mastodon_context.project,
        instance_url="https://hachyderm.io/@alice/",
        account_acct="@Alice",
    )
    credentials.set_access_token("access-token")
    credentials.save()
    credentials.refresh_from_db()

    assert credentials.instance_url == "https://hachyderm.io"
    assert credentials.account_acct == "alice@hachyderm.io"
    assert credentials.access_token_encrypted != "access-token"
    assert credentials.get_access_token() == "access-token"


def test_mastodon_client_uses_authenticated_project_credentials(
    mastodon_context, mocker
):
    credentials = MastodonCredentials(
        project=mastodon_context.project,
        instance_url="https://hachyderm.io",
        account_acct="alice@hachyderm.io",
    )
    credentials.set_access_token("access-token")
    credentials.save()
    client = mocker.Mock()
    mastodon_cls = mocker.patch("core.plugins.mastodon.Mastodon", return_value=client)

    plugin = MastodonSourcePlugin(mastodon_context.source_config)

    assert plugin._client() == client
    mastodon_cls.assert_called_once_with(
        access_token="access-token",
        api_base_url="https://hachyderm.io",
    )


def test_mastodon_verify_credentials_updates_verified_account(mastodon_context, mocker):
    credentials = MastodonCredentials(
        project=mastodon_context.project,
        instance_url="https://hachyderm.io",
    )
    credentials.set_access_token("access-token")
    credentials.save()
    client = mocker.Mock()
    client.account_verify_credentials.return_value = {
        "acct": "alice",
        "username": "alice",
        "url": "https://hachyderm.io/@alice",
    }
    mastodon_cls = mocker.patch("core.plugins.mastodon.Mastodon", return_value=client)

    MastodonSourcePlugin.verify_credentials(credentials)

    mastodon_cls.assert_called_once_with(
        access_token="access-token",
        api_base_url="https://hachyderm.io",
    )
    client.account_verify_credentials.assert_called_once_with()
    credentials.refresh_from_db()
    assert credentials.account_acct == "alice@hachyderm.io"
    assert credentials.last_error == ""
    assert credentials.last_verified_at is not None
