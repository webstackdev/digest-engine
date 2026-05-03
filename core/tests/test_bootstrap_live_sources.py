from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from projects.model_support import SourcePluginName
from projects.models import Project, SourceConfig

pytestmark = pytest.mark.django_db


def test_bootstrap_live_sources_creates_requested_source_configs():
    project = Project.objects.create(
        name="Bootstrap Project",
        topic_description="Platform engineering",
    )
    stdout = StringIO()

    call_command(
        "bootstrap_live_sources",
        project_id=project.id,
        rss_feed=[
            "https://example.com/feed.xml,https://example.com/another.xml",
        ],
        subreddit=["devops,kubernetes"],
        reddit_listing="hot",
        reddit_limit=30,
        stdout=stdout,
    )

    rss_configs = SourceConfig.objects.filter(
        project=project,
        plugin_name=SourcePluginName.RSS,
    ).order_by("id")
    reddit_configs = SourceConfig.objects.filter(
        project=project,
        plugin_name=SourcePluginName.REDDIT,
    ).order_by("id")

    assert rss_configs.count() == 2
    assert reddit_configs.count() == 2
    assert list(rss_configs.values_list("config__feed_url", flat=True)) == [
        "https://example.com/feed.xml",
        "https://example.com/another.xml",
    ]
    assert list(reddit_configs.values_list("config__subreddit", flat=True)) == [
        "devops",
        "kubernetes",
    ]
    assert all(config.config["listing"] == "hot" for config in reddit_configs)
    assert all(config.config["limit"] == 30 for config in reddit_configs)
    assert "Bootstrapped 4 source config(s)" in stdout.getvalue()


def test_bootstrap_live_sources_reactivates_and_updates_existing_sources():
    project = Project.objects.create(
        name="Bootstrap Project",
        topic_description="Platform engineering",
    )
    rss_source = SourceConfig.objects.create(
        project=project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
        is_active=False,
    )
    reddit_source = SourceConfig.objects.create(
        project=project,
        plugin_name=SourcePluginName.REDDIT,
        config={"subreddit": "devops", "listing": "new", "limit": 10},
        is_active=False,
    )

    call_command(
        "bootstrap_live_sources",
        project_name=project.name,
        rss_feed=["https://example.com/feed.xml"],
        subreddit=["devops"],
        reddit_listing="both",
        reddit_limit=25,
    )

    rss_source.refresh_from_db()
    reddit_source.refresh_from_db()

    assert rss_source.is_active is True
    assert reddit_source.is_active is True
    assert reddit_source.config == {
        "subreddit": "devops",
        "listing": "both",
        "limit": 25,
    }
    assert SourceConfig.objects.filter(project=project).count() == 2


def test_bootstrap_live_sources_requires_one_project_selector():
    with pytest.raises(
        CommandError, match="exactly one of --project-id or --project-name"
    ):
        call_command(
            "bootstrap_live_sources", rss_feed=["https://example.com/feed.xml"]
        )
