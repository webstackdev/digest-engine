from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from django.db.models import Model

from content.models import Content
from entities.models import Entity
from ingestion.models import IngestionRun, RunStatus
from ingestion.tasks import _ingest_source_config, run_all_ingestions, run_ingestion
from projects.model_support import SourcePluginName
from projects.models import Project, SourceConfig

pytestmark = pytest.mark.django_db


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed task assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


@pytest.fixture
def source_plugin_context(django_user_model):
    user = django_user_model.objects.create_user(
        username="plugin-owner", password="testpass123"
    )
    project = Project.objects.create(name="Plugin Project", topic_description="Infra")
    entity = Entity.objects.create(
        project=project,
        name="Example",
        type="vendor",
        website_url="https://example.com",
    )
    return SimpleNamespace(user=user, project=project, entity=entity)


def test_run_ingestion_creates_content_from_rss_entries(source_plugin_context, mocker):
    upsert_embedding_mock = mocker.patch("core.embeddings.upsert_content_embedding")
    process_content_delay_mock = mocker.patch("core.tasks.process_content.delay")
    parse_mock = mocker.patch("ingestion.plugins.rss.feedparser.parse")
    source_config = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    parse_mock.return_value = SimpleNamespace(
        entries=[
            SimpleNamespace(
                link="https://example.com/post-1",
                title="Example Post",
                author="Author",
                summary="Summary",
                published_parsed=datetime(
                    2026, 4, 20, 12, 0, tzinfo=timezone.utc
                ).timetuple(),
            )
        ]
    )

    result = run_ingestion(_require_pk(source_config))

    assert result["items_fetched"] == 1
    assert result["items_ingested"] == 1
    content = Content.objects.get(url="https://example.com/post-1")
    assert content.project == source_plugin_context.project
    assert content.entity == source_plugin_context.entity
    upsert_embedding_mock.assert_called_once_with(content)
    process_content_delay_mock.assert_called_once_with(_require_pk(content))
    assert (
        SourceConfig.objects.get(pk=_require_pk(source_config)).last_fetched_at
        is not None
    )
    ingestion_run = IngestionRun.objects.get(
        project=source_plugin_context.project, plugin_name=SourcePluginName.RSS
    )
    assert ingestion_run.status == RunStatus.SUCCESS


def test_run_ingestion_skips_same_source_duplicate_urls(source_plugin_context, mocker):
    upsert_embedding_mock = mocker.patch("core.embeddings.upsert_content_embedding")
    process_content_delay_mock = mocker.patch("core.tasks.process_content.delay")
    parse_mock = mocker.patch("ingestion.plugins.rss.feedparser.parse")
    source_config = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/post-1",
        title="Existing",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Existing content",
    )
    parse_mock.return_value = SimpleNamespace(
        entries=[
            SimpleNamespace(
                link="https://example.com/post-1",
                title="Duplicate Post",
                author="Author",
                summary="Summary",
                published_parsed=datetime(
                    2026, 4, 20, 12, 0, tzinfo=timezone.utc
                ).timetuple(),
            )
        ]
    )

    result = run_ingestion(_require_pk(source_config))

    assert result["items_fetched"] == 1
    assert result["items_ingested"] == 0
    upsert_embedding_mock.assert_not_called()
    process_content_delay_mock.assert_not_called()
    assert Content.objects.filter(url="https://example.com/post-1").count() == 1


def test_ingest_source_config_allows_cross_plugin_duplicate_urls_for_pipeline_dedup(
    source_plugin_context, mocker
):
    upsert_embedding_mock = mocker.patch("core.embeddings.upsert_content_embedding")
    process_content_delay_mock = mocker.patch("core.tasks.process_content.delay")
    source_config = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.REDDIT,
        config={"subreddit": "python", "listing": "new", "limit": 5},
    )
    Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/post-1",
        canonical_url="https://example.com/post-1",
        title="Existing RSS Item",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Existing content",
    )
    plugin = SimpleNamespace(
        fetch_new_content=lambda since: [
            SimpleNamespace(
                url="https://example.com/post-1",
                title="Reddit duplicate that should still enter the pipeline",
                author="redditor",
                published_date=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
                content_text="A community post linking to the same article.",
                source_plugin=SourcePluginName.REDDIT,
                source_metadata={},
            )
        ],
        match_entity_for_url=lambda url: None,
    )
    mocker.patch("ingestion.tasks.get_plugin_for_source_config", return_value=plugin)

    items_fetched, items_ingested = _ingest_source_config(source_config)

    assert items_fetched == 1
    assert items_ingested == 1
    assert Content.objects.filter(project=source_plugin_context.project).count() == 2
    upsert_embedding_mock.assert_called_once()
    process_content_delay_mock.assert_called_once()


def test_run_ingestion_creates_content_from_reddit_posts(source_plugin_context, mocker):
    upsert_embedding_mock = mocker.patch("core.embeddings.upsert_content_embedding")
    process_content_delay_mock = mocker.patch("core.tasks.process_content.delay")
    reddit_mock = mocker.patch("ingestion.plugins.reddit.praw.Reddit")
    source_config = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.REDDIT,
        config={"subreddit": "python", "listing": "new", "limit": 5},
    )
    submission = SimpleNamespace(
        id="abc123",
        url="https://reddit.com/r/python/comments/abc123/test",
        permalink="/r/python/comments/abc123/test",
        title="Reddit Post",
        selftext="Post body",
        author="redditor",
        created_utc=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc).timestamp(),
    )
    subreddit = SimpleNamespace(
        new=lambda limit: iter([submission]), hot=lambda limit: iter([])
    )
    reddit_mock.return_value.subreddit.return_value = subreddit

    result = run_ingestion(_require_pk(source_config))

    assert result["items_fetched"] == 1
    assert result["items_ingested"] == 1
    content = Content.objects.get(title="Reddit Post")
    upsert_embedding_mock.assert_called_once_with(content)
    process_content_delay_mock.assert_called_once_with(_require_pk(content))
    assert content.source_plugin == SourcePluginName.REDDIT
    assert content.entity is None


def test_ingest_source_config_deduplicates_bluesky_posts_by_post_uri(
    source_plugin_context, mocker
):
    upsert_embedding_mock = mocker.patch("core.embeddings.upsert_content_embedding")
    process_content_delay_mock = mocker.patch("core.tasks.process_content.delay")
    source_config = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.BLUESKY,
        config={"author_handle": "example.bsky.social"},
    )
    Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/existing-article",
        title="Existing Bluesky Post",
        author="example.bsky.social",
        source_plugin=SourcePluginName.BLUESKY,
        published_date="2026-04-20T12:00:00Z",
        content_text="Existing content",
        source_metadata={"post_uri": "at://did:plc:author/app.bsky.feed.post/abc123"},
    )
    plugin = SimpleNamespace(
        fetch_new_content=lambda since: [
            SimpleNamespace(
                url="https://example.com/new-canonical-url",
                title="Duplicate Bluesky Post",
                author="example.bsky.social",
                published_date=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
                content_text="Duplicate content",
                source_plugin=SourcePluginName.BLUESKY,
                source_metadata={
                    "author_handle": "example.bsky.social",
                    "post_uri": "at://did:plc:author/app.bsky.feed.post/abc123",
                },
            )
        ],
        match_entity_for_item=lambda item: source_plugin_context.entity,
    )
    mocker.patch("ingestion.tasks.get_plugin_for_source_config", return_value=plugin)

    items_fetched, items_ingested = _ingest_source_config(source_config)

    assert items_fetched == 1
    assert items_ingested == 0
    assert Content.objects.filter(project=source_plugin_context.project).count() == 1
    upsert_embedding_mock.assert_not_called()
    process_content_delay_mock.assert_not_called()


def test_ingest_source_config_deduplicates_mastodon_statuses_by_status_uri(
    source_plugin_context, mocker
):
    upsert_embedding_mock = mocker.patch("core.embeddings.upsert_content_embedding")
    process_content_delay_mock = mocker.patch("core.tasks.process_content.delay")
    source_config = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.MASTODON,
        config={
            "instance_url": "https://hachyderm.io",
            "hashtag": "platformengineering",
        },
    )
    Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/existing-article",
        title="Existing Mastodon Status",
        author="Alice Example",
        source_plugin=SourcePluginName.MASTODON,
        published_date="2026-04-20T12:00:00Z",
        content_text="Existing content",
        source_metadata={
            "status_uri": "https://hachyderm.io/users/alice/statuses/abc123"
        },
    )
    plugin = SimpleNamespace(
        fetch_new_content=lambda since: [
            SimpleNamespace(
                url="https://example.com/new-canonical-url",
                title="Duplicate Mastodon Status",
                author="Alice Example",
                published_date=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
                content_text="Duplicate content",
                source_plugin=SourcePluginName.MASTODON,
                source_metadata={
                    "author_acct": "alice@hachyderm.io",
                    "status_uri": "https://hachyderm.io/users/alice/statuses/abc123",
                },
            )
        ],
        match_entity_for_item=lambda item: source_plugin_context.entity,
    )
    mocker.patch("ingestion.tasks.get_plugin_for_source_config", return_value=plugin)

    items_fetched, items_ingested = _ingest_source_config(source_config)

    assert items_fetched == 1
    assert items_ingested == 0
    assert Content.objects.filter(project=source_plugin_context.project).count() == 1
    upsert_embedding_mock.assert_not_called()
    process_content_delay_mock.assert_not_called()


def test_run_all_ingestions_enqueues_active_source_configs(
    source_plugin_context, mocker
):
    delay_mock = mocker.patch("ingestion.tasks.run_ingestion.delay")
    active_one = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    active_two = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.REDDIT,
        config={"subreddit": "python"},
    )
    SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/inactive.xml"},
        is_active=False,
    )

    enqueued_count = run_all_ingestions()

    assert enqueued_count == 2
    delay_mock.assert_any_call(_require_pk(active_one))
    delay_mock.assert_any_call(_require_pk(active_two))
    assert delay_mock.call_count == 2


def test_run_all_ingestions_executes_inline_when_eager(
    source_plugin_context, settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    run_ingestion_mock = mocker.patch("ingestion.tasks.run_ingestion")
    delay_mock = mocker.patch("ingestion.tasks.run_ingestion.delay")
    active_one = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    active_two = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.REDDIT,
        config={"subreddit": "python"},
    )

    enqueued_count = run_all_ingestions()

    assert enqueued_count == 2
    run_ingestion_mock.assert_any_call(_require_pk(active_one))
    run_ingestion_mock.assert_any_call(_require_pk(active_two))
    assert run_ingestion_mock.call_count == 2
    delay_mock.assert_not_called()


def test_run_ingestion_marks_failure_when_plugin_errors(source_plugin_context, mocker):
    parse_mock = mocker.patch("ingestion.plugins.rss.feedparser.parse")
    source_config = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    parse_mock.side_effect = RuntimeError("feed unavailable")

    with pytest.raises(RuntimeError, match="feed unavailable"):
        run_ingestion(_require_pk(source_config))

    ingestion_run = IngestionRun.objects.get(
        project=source_plugin_context.project, plugin_name=SourcePluginName.RSS
    )
    assert ingestion_run.status == RunStatus.FAILED
    assert ingestion_run.error_message == "feed unavailable"


def test_ingest_source_config_truncates_fields_and_processes_inline(
    source_plugin_context, settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    plugin = mocker.Mock()
    plugin.fetch_new_content.return_value = [
        SimpleNamespace(
            url="https://example.com/post-long",
            title="T" * 600,
            author="A" * 300,
            source_plugin=SourcePluginName.RSS,
            published_date=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
            content_text="Summary",
        )
    ]
    plugin.match_entity_for_url.return_value = source_plugin_context.entity
    source_config = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    mocker.patch("ingestion.tasks.get_plugin_for_source_config", return_value=plugin)
    upsert_mock = mocker.patch("core.embeddings.upsert_content_embedding")
    process_mock = mocker.patch("core.tasks.process_content")
    delay_mock = mocker.patch("core.tasks.process_content.delay")

    items_fetched, items_ingested = _ingest_source_config(source_config)

    created = Content.objects.get(url="https://example.com/post-long")
    assert items_fetched == 1
    assert items_ingested == 1
    assert created.entity == source_plugin_context.entity
    assert len(created.title) == 512
    assert len(created.author) == 255
    upsert_mock.assert_called_once_with(created)
    process_mock.assert_called_once_with(_require_pk(created))
    delay_mock.assert_not_called()
