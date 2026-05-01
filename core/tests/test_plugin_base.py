from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Callable, cast

import pytest

from core.models import Entity, Project
from core.plugins.base import ContentItem, SourcePlugin

pytestmark = pytest.mark.django_db


class DummySourcePlugin(SourcePlugin):
    required_config_fields = ("api_key",)

    def fetch_new_content(self, since):
        return [
            ContentItem(
                url="https://example.com/item",
                title="Example",
                author="Author",
                published_date=datetime(2026, 4, 28, 12, 0, tzinfo=UTC),
                content_text="Body",
                source_plugin="dummy",
            )
        ]

    def health_check(self) -> bool:
        return True


@pytest.fixture
def plugin_context():
    project = Project.objects.create(name="Plugin Project", topic_description="Infra")
    source_config = SimpleNamespace(project=project, config={"api_key": "secret"})
    return SimpleNamespace(project=project, source_config=source_config)


def test_source_plugin_validate_config_requires_object_and_required_fields():
    assert DummySourcePlugin.validate_config({"api_key": "secret", "extra": True}) == {
        "api_key": "secret",
        "extra": True,
    }

    with pytest.raises(ValueError, match="Config must be a JSON object"):
        DummySourcePlugin.validate_config("not-an-object")

    with pytest.raises(ValueError, match="Missing required config field: api_key"):
        DummySourcePlugin.validate_config({})


def test_source_plugin_match_entity_for_url_matches_normalized_hostname(plugin_context):
    matching_entity = Entity.objects.create(
        project=plugin_context.project,
        name="Matching Entity",
        type="vendor",
        website_url="https://www.example.com/company",
    )
    Entity.objects.create(
        project=plugin_context.project,
        name="Blank Website",
        type="vendor",
        website_url="",
    )
    plugin = DummySourcePlugin(plugin_context.source_config)

    result = plugin.match_entity_for_url("https://example.com/posts/123")

    assert result == matching_entity


def test_source_plugin_match_entity_for_url_returns_none_for_missing_hostname(
    plugin_context,
):
    plugin = DummySourcePlugin(plugin_context.source_config)

    assert plugin.match_entity_for_url("not-a-valid-url") is None
    assert (
        DummySourcePlugin._normalize_hostname("https://www.EXAMPLE.com/path")
        == "example.com"
    )


def test_source_plugin_match_entity_for_url_returns_none_when_no_entity_matches(
    plugin_context,
):
    Entity.objects.create(
        project=plugin_context.project,
        name="Different Entity",
        type="vendor",
        website_url="https://other.example.com",
    )
    plugin = DummySourcePlugin(plugin_context.source_config)

    assert plugin.match_entity_for_url("https://example.com/posts/123") is None


def test_source_plugin_match_entity_for_item_delegates_to_url_matching(plugin_context):
    matching_entity = Entity.objects.create(
        project=plugin_context.project,
        name="Matching Entity",
        type="vendor",
        website_url="https://example.com/company",
    )
    plugin = DummySourcePlugin(plugin_context.source_config)

    result = plugin.match_entity_for_item(
        ContentItem(
            url="https://example.com/posts/123",
            title="Example",
            author="Author",
            published_date=datetime(2026, 4, 28, 12, 0, tzinfo=UTC),
            content_text="Body",
            source_plugin="dummy",
        )
    )

    assert result == matching_entity


def test_source_plugin_abstract_methods_raise_not_implemented(plugin_context):
    plugin = DummySourcePlugin(plugin_context.source_config)
    fetch_method = cast(
        Callable[[SourcePlugin, datetime | None], list[ContentItem]],
        SourcePlugin.__dict__["fetch_new_content"],
    )
    health_check_method = cast(
        Callable[[SourcePlugin], bool],
        SourcePlugin.__dict__["health_check"],
    )

    with pytest.raises(NotImplementedError):
        fetch_method(plugin, None)

    with pytest.raises(NotImplementedError):
        health_check_method(plugin)


def test_dummy_source_plugin_implements_abstract_contract(plugin_context):
    plugin = DummySourcePlugin(plugin_context.source_config)

    items = plugin.fetch_new_content(since=None)

    assert plugin.health_check() is True
    assert items[0].source_plugin == "dummy"
