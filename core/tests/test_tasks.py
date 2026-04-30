from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from core.models import (
    Content,
    Entity,
    EntityAuthoritySnapshot,
    EntityMention,
    EntityMentionRole,
    FeedbackType,
    IngestionRun,
    RunStatus,
    SkillStatus,
    TopicCentroidSnapshot,
    UserFeedback,
)
from core.pipeline import RELEVANCE_SKILL_NAME, SUMMARIZATION_SKILL_NAME
from core.tasks import (
    TOPIC_CENTROID_MIN_UPVOTES,
    queue_content_skill,
    queue_topic_centroid_recompute,
    recompute_authority_scores,
    recompute_topic_centroid,
    run_all_authority_recomputations,
    run_all_topic_centroid_recomputations,
    run_relevance_scoring_skill,
    run_summarization_skill,
)
from ingestion.tasks import _ingest_source_config, run_all_ingestions, run_ingestion
from projects.model_support import SourcePluginName
from projects.models import Project, ProjectConfig, SourceConfig

pytestmark = pytest.mark.django_db


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
    upsert_embedding_mock = mocker.patch("core.tasks.upsert_content_embedding")
    process_content_delay_mock = mocker.patch("core.tasks.process_content.delay")
    parse_mock = mocker.patch("core.plugins.rss.feedparser.parse")
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

    result = run_ingestion(source_config.id)

    assert result["items_fetched"] == 1
    assert result["items_ingested"] == 1
    content = Content.objects.get(url="https://example.com/post-1")
    assert content.project == source_plugin_context.project
    assert content.entity == source_plugin_context.entity
    upsert_embedding_mock.assert_called_once_with(content)
    process_content_delay_mock.assert_called_once_with(content.id)
    assert SourceConfig.objects.get(pk=source_config.id).last_fetched_at is not None
    ingestion_run = IngestionRun.objects.get(
        project=source_plugin_context.project, plugin_name=SourcePluginName.RSS
    )
    assert ingestion_run.status == RunStatus.SUCCESS


def test_run_ingestion_skips_same_source_duplicate_urls(source_plugin_context, mocker):
    upsert_embedding_mock = mocker.patch("core.tasks.upsert_content_embedding")
    process_content_delay_mock = mocker.patch("core.tasks.process_content.delay")
    parse_mock = mocker.patch("core.plugins.rss.feedparser.parse")
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

    result = run_ingestion(source_config.id)

    assert result["items_fetched"] == 1
    assert result["items_ingested"] == 0
    upsert_embedding_mock.assert_not_called()
    process_content_delay_mock.assert_not_called()
    assert Content.objects.filter(url="https://example.com/post-1").count() == 1


def test_ingest_source_config_allows_cross_plugin_duplicate_urls_for_pipeline_dedup(
    source_plugin_context, mocker
):
    upsert_embedding_mock = mocker.patch("core.tasks.upsert_content_embedding")
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
    upsert_embedding_mock = mocker.patch("core.tasks.upsert_content_embedding")
    process_content_delay_mock = mocker.patch("core.tasks.process_content.delay")
    reddit_mock = mocker.patch("core.plugins.reddit.praw.Reddit")
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

    result = run_ingestion(source_config.id)

    assert result["items_fetched"] == 1
    assert result["items_ingested"] == 1
    content = Content.objects.get(title="Reddit Post")
    upsert_embedding_mock.assert_called_once_with(content)
    process_content_delay_mock.assert_called_once_with(content.id)
    assert content.source_plugin == SourcePluginName.REDDIT
    assert content.entity is None


def test_ingest_source_config_deduplicates_bluesky_posts_by_post_uri(
    source_plugin_context, mocker
):
    upsert_embedding_mock = mocker.patch("core.tasks.upsert_content_embedding")
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
    delay_mock.assert_any_call(active_one.id)
    delay_mock.assert_any_call(active_two.id)
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
    run_ingestion_mock.assert_any_call(active_one.id)
    run_ingestion_mock.assert_any_call(active_two.id)
    assert run_ingestion_mock.call_count == 2
    delay_mock.assert_not_called()


def test_run_all_authority_recomputations_enqueues_all_projects(
    source_plugin_context, mocker
):
    delay_mock = mocker.patch("core.tasks.recompute_authority_scores.delay")
    other_project = Project.objects.create(
        name="Other Project",
        topic_description="Security",
    )

    enqueued_count = run_all_authority_recomputations()

    assert enqueued_count == 2
    delay_mock.assert_any_call(source_plugin_context.project.id)
    delay_mock.assert_any_call(other_project.id)
    assert delay_mock.call_count == 2


def test_run_all_authority_recomputations_executes_inline_when_eager(
    source_plugin_context, settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    recompute_mock = mocker.patch("core.tasks.recompute_authority_scores")
    delay_mock = mocker.patch("core.tasks.recompute_authority_scores.delay")
    other_project = Project.objects.create(
        name="Inline Project",
        topic_description="Platform",
    )

    enqueued_count = run_all_authority_recomputations()

    assert enqueued_count == 2
    recompute_mock.assert_any_call(source_plugin_context.project.id)
    recompute_mock.assert_any_call(other_project.id)
    assert recompute_mock.call_count == 2
    delay_mock.assert_not_called()


def test_run_all_topic_centroid_recomputations_enqueues_all_projects(
    source_plugin_context, mocker
):
    delay_mock = mocker.patch("core.tasks.recompute_topic_centroid.delay")
    other_project = Project.objects.create(
        name="Other Centroid Project",
        topic_description="Security",
    )

    enqueued_count = run_all_topic_centroid_recomputations()

    assert enqueued_count == 2
    delay_mock.assert_any_call(source_plugin_context.project.id)
    delay_mock.assert_any_call(other_project.id)
    assert delay_mock.call_count == 2


def test_run_all_topic_centroid_recomputations_executes_inline_when_eager(
    source_plugin_context, settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    recompute_mock = mocker.patch("core.tasks.recompute_topic_centroid")
    delay_mock = mocker.patch("core.tasks.recompute_topic_centroid.delay")
    other_project = Project.objects.create(
        name="Inline Centroid Project",
        topic_description="Platform",
    )

    enqueued_count = run_all_topic_centroid_recomputations()

    assert enqueued_count == 2
    recompute_mock.assert_any_call(source_plugin_context.project.id)
    recompute_mock.assert_any_call(other_project.id)
    assert recompute_mock.call_count == 2
    delay_mock.assert_not_called()


def test_recompute_authority_scores_updates_entities_and_creates_snapshots(
    source_plugin_context, mocker
):
    mocker.patch("core.signals.queue_topic_centroid_recompute")
    project = source_plugin_context.project
    config = ProjectConfig.objects.create(
        project=project,
        upvote_authority_weight=0.2,
        downvote_authority_weight=-0.1,
        authority_decay_rate=0.9,
    )
    primary_entity = source_plugin_context.entity
    secondary_entity = Entity.objects.create(
        project=project,
        name="Secondary",
        type="vendor",
        authority_score=0.5,
    )
    primary_content = Content.objects.create(
        project=project,
        entity=primary_entity,
        url="https://example.com/authority-primary",
        title="Authority Primary",
        author="Reporter",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-28T12:00:00Z",
        content_text="Primary authority content.",
        duplicate_signal_count=3,
    )
    secondary_content = Content.objects.create(
        project=project,
        entity=secondary_entity,
        url="https://example.com/authority-secondary",
        title="Authority Secondary",
        author="Reporter",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-28T13:00:00Z",
        content_text="Secondary authority content.",
    )
    EntityMention.objects.create(
        project=project,
        content=primary_content,
        entity=primary_entity,
        role=EntityMentionRole.SUBJECT,
        sentiment="positive",
        span="Example",
        confidence=0.9,
    )
    EntityMention.objects.create(
        project=project,
        content=secondary_content,
        entity=secondary_entity,
        role=EntityMentionRole.SUBJECT,
        sentiment="neutral",
        span="Secondary",
        confidence=0.8,
    )
    UserFeedback.objects.create(
        project=project,
        content=primary_content,
        user=source_plugin_context.user,
        feedback_type=FeedbackType.UPVOTE,
    )

    result = recompute_authority_scores(project.id)

    primary_entity.refresh_from_db()
    secondary_entity.refresh_from_db()
    primary_snapshot = EntityAuthoritySnapshot.objects.get(entity=primary_entity)
    secondary_snapshot = EntityAuthoritySnapshot.objects.get(entity=secondary_entity)

    assert result == {"project_id": project.id, "entities_updated": 2}
    assert primary_entity.authority_score > secondary_entity.authority_score
    assert primary_snapshot.final_score == pytest.approx(primary_entity.authority_score)
    assert secondary_snapshot.final_score == pytest.approx(
        secondary_entity.authority_score
    )
    assert primary_snapshot.feedback_component > 0.5
    assert primary_snapshot.duplicate_component > secondary_snapshot.duplicate_component
    assert primary_snapshot.decayed_prior == pytest.approx(
        config.authority_decay_rate * 0.5
    )


def test_recompute_topic_centroid_upserts_weighted_normalized_centroid(
    source_plugin_context, mocker
):
    project = source_plugin_context.project
    mocker.patch("core.signals.queue_topic_centroid_recompute")
    upsert_mock = mocker.patch("core.tasks.upsert_topic_centroid")
    delete_mock = mocker.patch("core.tasks.delete_topic_centroid")
    vector_lookup = {
        **{
            f"Upvote {index}": [1.0, 0.0] for index in range(TOPIC_CENTROID_MIN_UPVOTES)
        },
        "Downvote": [0.0, 1.0],
    }
    mocker.patch(
        "core.tasks.embed_text",
        side_effect=lambda text: vector_lookup[text.split("\n\n", 1)[0]],
    )

    upvote_contents = []
    for index in range(TOPIC_CENTROID_MIN_UPVOTES):
        upvote_contents.append(
            Content.objects.create(
                project=project,
                entity=source_plugin_context.entity,
                url=f"https://example.com/upvote-{index}",
                title=f"Upvote {index}",
                author="Author",
                source_plugin=SourcePluginName.RSS,
                published_date="2026-04-20T12:00:00Z",
                content_text="Manual content body",
            )
        )
    downvote_content = Content.objects.create(
        project=project,
        entity=source_plugin_context.entity,
        url="https://example.com/downvote",
        title="Downvote",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Manual content body",
    )
    for content in upvote_contents:
        UserFeedback.objects.create(
            project=project,
            content=content,
            user=source_plugin_context.user,
            feedback_type=FeedbackType.UPVOTE,
        )
    second_user = source_plugin_context.user.__class__.objects.create_user(
        username="downvote-owner", password="testpass123"
    )
    UserFeedback.objects.create(
        project=project,
        content=downvote_content,
        user=second_user,
        feedback_type=FeedbackType.DOWNVOTE,
    )

    result = recompute_topic_centroid(project.id)
    snapshot = TopicCentroidSnapshot.objects.get(project=project)

    assert result["centroid_active"] is True
    delete_mock.assert_not_called()
    upsert_mock.assert_called_once()
    centroid_vector = upsert_mock.call_args.args[1]
    assert centroid_vector[0] > 0.9
    assert centroid_vector[1] < 0.0
    assert snapshot.centroid_active is True
    assert snapshot.feedback_count == TOPIC_CENTROID_MIN_UPVOTES + 1
    assert snapshot.upvote_count == TOPIC_CENTROID_MIN_UPVOTES
    assert snapshot.downvote_count == 1
    assert snapshot.centroid_vector == pytest.approx(centroid_vector)
    assert snapshot.drift_from_previous is None
    assert snapshot.drift_from_week_ago is None


def test_recompute_topic_centroid_persists_drift_from_previous_and_week_old_snapshot(
    source_plugin_context, mocker
):
    project = source_plugin_context.project
    mocker.patch("core.signals.queue_topic_centroid_recompute")
    upsert_mock = mocker.patch("core.tasks.upsert_topic_centroid")
    delete_mock = mocker.patch("core.tasks.delete_topic_centroid")
    mocker.patch("core.tasks.embed_text", return_value=[1.0, 0.0])

    recent_snapshot = TopicCentroidSnapshot.objects.create(
        project=project,
        centroid_active=True,
        centroid_vector=[1.0, 0.0],
        feedback_count=12,
        upvote_count=12,
        downvote_count=0,
    )
    older_snapshot = TopicCentroidSnapshot.objects.create(
        project=project,
        centroid_active=True,
        centroid_vector=[0.0, 1.0],
        feedback_count=12,
        upvote_count=12,
        downvote_count=0,
    )
    TopicCentroidSnapshot.objects.filter(pk=recent_snapshot.pk).update(
        computed_at=datetime(2026, 4, 28, 12, 0, tzinfo=timezone.utc)
    )
    TopicCentroidSnapshot.objects.filter(pk=older_snapshot.pk).update(
        computed_at=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc)
    )

    for index in range(TOPIC_CENTROID_MIN_UPVOTES):
        content = Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url=f"https://example.com/drift-upvote-{index}",
            title=f"Drift Upvote {index}",
            author="Author",
            source_plugin=SourcePluginName.RSS,
            published_date="2026-04-20T12:00:00Z",
            content_text="Manual content body",
        )
        UserFeedback.objects.create(
            project=project,
            content=content,
            user=source_plugin_context.user,
            feedback_type=FeedbackType.UPVOTE,
        )

    result = recompute_topic_centroid(project.id)
    snapshot = TopicCentroidSnapshot.objects.filter(project=project).latest(
        "computed_at"
    )

    assert result["centroid_active"] is True
    delete_mock.assert_not_called()
    upsert_mock.assert_called_once()
    assert snapshot.centroid_active is True
    assert snapshot.drift_from_previous == pytest.approx(0.0)
    assert snapshot.drift_from_week_ago == pytest.approx(1.0)


def test_recompute_topic_centroid_disables_centroid_below_minimum_upvotes(
    source_plugin_context, mocker
):
    project = source_plugin_context.project
    mocker.patch("core.signals.queue_topic_centroid_recompute")
    upsert_mock = mocker.patch("core.tasks.upsert_topic_centroid")
    delete_mock = mocker.patch("core.tasks.delete_topic_centroid")
    for index in range(TOPIC_CENTROID_MIN_UPVOTES - 1):
        content = Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url=f"https://example.com/too-few-{index}",
            title=f"Too Few {index}",
            author="Author",
            source_plugin=SourcePluginName.RSS,
            published_date="2026-04-20T12:00:00Z",
            content_text="Manual content body",
        )
        UserFeedback.objects.create(
            project=project,
            content=content,
            user=source_plugin_context.user,
            feedback_type=FeedbackType.UPVOTE,
        )

    result = recompute_topic_centroid(project.id)
    snapshot = TopicCentroidSnapshot.objects.get(project=project)

    assert result["centroid_active"] is False
    delete_mock.assert_called_once_with(project.id)
    upsert_mock.assert_not_called()
    assert snapshot.centroid_active is False
    assert snapshot.centroid_vector == []
    assert snapshot.upvote_count == TOPIC_CENTROID_MIN_UPVOTES - 1
    assert snapshot.drift_from_previous is None


def test_run_ingestion_marks_failure_when_plugin_errors(source_plugin_context, mocker):
    parse_mock = mocker.patch("core.plugins.rss.feedparser.parse")
    source_config = SourceConfig.objects.create(
        project=source_plugin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    parse_mock.side_effect = RuntimeError("feed unavailable")

    with pytest.raises(RuntimeError, match="feed unavailable"):
        run_ingestion(source_config.id)

    ingestion_run = IngestionRun.objects.get(
        project=source_plugin_context.project, plugin_name=SourcePluginName.RSS
    )
    assert ingestion_run.status == RunStatus.FAILED
    assert ingestion_run.error_message == "feed unavailable"


def test_queue_content_skill_enqueues_relevance_task(source_plugin_context, mocker):
    content = Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/manual-content",
        title="Manual Content",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Manual content body",
    )
    delay_mock = mocker.patch("core.tasks.run_relevance_scoring_skill.delay")

    skill_result = queue_content_skill(content, RELEVANCE_SKILL_NAME)

    assert skill_result.status == SkillStatus.PENDING
    delay_mock.assert_called_once_with(skill_result.id)


def test_queue_content_skill_executes_inline_when_eager(
    source_plugin_context, settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    content = Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/manual-inline-content",
        title="Manual Inline Content",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Manual content body",
    )
    task_mock = mocker.patch("core.tasks.run_relevance_scoring_skill")
    delay_mock = mocker.patch("core.tasks.run_relevance_scoring_skill.delay")

    skill_result = queue_content_skill(content, RELEVANCE_SKILL_NAME)

    assert skill_result.status == SkillStatus.PENDING
    task_mock.assert_called_once_with(skill_result.id)
    delay_mock.assert_not_called()


def test_queue_content_skill_executes_summary_inline_when_eager(
    source_plugin_context, settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    content = Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/manual-inline-summary",
        title="Manual Inline Summary",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Manual content body",
        relevance_score=0.9,
    )
    task_mock = mocker.patch("core.tasks.run_summarization_skill")
    delay_mock = mocker.patch("core.tasks.run_summarization_skill.delay")

    skill_result = queue_content_skill(content, SUMMARIZATION_SKILL_NAME)

    assert skill_result.status == SkillStatus.PENDING
    task_mock.assert_called_once_with(skill_result.id)
    delay_mock.assert_not_called()


def test_queue_topic_centroid_recompute_enqueues_background_task(
    source_plugin_context, mocker
):
    cache_add_mock = mocker.patch("core.tasks.cache.add", return_value=True)
    delay_mock = mocker.patch("core.tasks.recompute_topic_centroid.delay")

    queued = queue_topic_centroid_recompute(source_plugin_context.project.id)

    assert queued is True
    cache_add_mock.assert_called_once()
    delay_mock.assert_called_once_with(source_plugin_context.project.id)


def test_queue_topic_centroid_recompute_skips_duplicate_queue_attempts(
    source_plugin_context, mocker
):
    mocker.patch("core.tasks.cache.add", return_value=False)
    delay_mock = mocker.patch("core.tasks.recompute_topic_centroid.delay")

    queued = queue_topic_centroid_recompute(source_plugin_context.project.id)

    assert queued is False
    delay_mock.assert_not_called()


def test_feedback_model_create_queues_topic_centroid_recompute(
    source_plugin_context, mocker
):
    content = Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/direct-feedback-content",
        title="Direct Feedback Content",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Manual content body",
    )
    queue_mock = mocker.patch("core.signals.queue_topic_centroid_recompute")

    UserFeedback.objects.create(
        project=source_plugin_context.project,
        content=content,
        user=source_plugin_context.user,
        feedback_type=FeedbackType.UPVOTE,
    )

    queue_mock.assert_called_once_with(source_plugin_context.project.id)


def test_feedback_model_update_queues_topic_centroid_recompute(
    source_plugin_context, mocker
):
    content = Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/direct-feedback-update",
        title="Direct Feedback Update",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Manual content body",
    )
    queue_mock = mocker.patch("core.signals.queue_topic_centroid_recompute")
    feedback = UserFeedback.objects.create(
        project=source_plugin_context.project,
        content=content,
        user=source_plugin_context.user,
        feedback_type=FeedbackType.UPVOTE,
    )

    queue_mock.reset_mock()
    feedback.feedback_type = FeedbackType.DOWNVOTE
    feedback.save(update_fields=["feedback_type"])

    queue_mock.assert_called_once_with(source_plugin_context.project.id)


def test_feedback_save_skips_topic_centroid_recompute_when_project_config_disables_it(
    source_plugin_context, mocker
):
    ProjectConfig.objects.create(
        project=source_plugin_context.project,
        recompute_topic_centroid_on_feedback_save=False,
    )
    content = Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/direct-feedback-disabled",
        title="Direct Feedback Disabled",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Manual content body",
    )
    queue_mock = mocker.patch("core.signals.queue_topic_centroid_recompute")

    feedback = UserFeedback.objects.create(
        project=source_plugin_context.project,
        content=content,
        user=source_plugin_context.user,
        feedback_type=FeedbackType.UPVOTE,
    )
    feedback.feedback_type = FeedbackType.DOWNVOTE
    feedback.save(update_fields=["feedback_type"])

    queue_mock.assert_not_called()


def test_run_relevance_scoring_skill_updates_pending_result(
    source_plugin_context, mocker
):
    content = Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/relevance-content",
        title="Relevance Content",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Manual content body",
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": 0.82,
            "explanation": "Strong match for the project topic.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )
    delay_mock = mocker.patch("core.tasks.run_relevance_scoring_skill.delay")

    pending_result = queue_content_skill(content, RELEVANCE_SKILL_NAME)
    delay_mock.assert_called_once_with(pending_result.id)

    result = run_relevance_scoring_skill(pending_result.id)

    content.refresh_from_db()
    pending_result.refresh_from_db()
    assert result.status == SkillStatus.COMPLETED
    assert pending_result.status == SkillStatus.COMPLETED
    assert content.relevance_score == pytest.approx(0.82)
    assert content.is_active is True


def test_run_summarization_skill_marks_result_failed_when_relevance_is_too_low(
    source_plugin_context, mocker
):
    content = Content.objects.create(
        project=source_plugin_context.project,
        entity=source_plugin_context.entity,
        url="https://example.com/summary-content",
        title="Summary Content",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-20T12:00:00Z",
        content_text="Manual content body",
        relevance_score=0.25,
    )
    delay_mock = mocker.patch("core.tasks.run_summarization_skill.delay")

    pending_result = queue_content_skill(content, SUMMARIZATION_SKILL_NAME)
    delay_mock.assert_called_once_with(pending_result.id)

    result = run_summarization_skill(pending_result.id)

    pending_result.refresh_from_db()
    assert result.status == SkillStatus.FAILED
    assert pending_result.status == SkillStatus.FAILED
    assert "Summarization requires relevance_score" in pending_result.error_message


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
    upsert_mock = mocker.patch("core.tasks.upsert_content_embedding")
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
    process_mock.assert_called_once_with(created.id)
    delay_mock.assert_not_called()
