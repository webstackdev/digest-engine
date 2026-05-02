from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from django.db.models import Model

from content.models import Content, FeedbackType, UserFeedback
from entities.models import Entity, EntityMention, EntityMentionRole
from projects.model_support import SourcePluginName
from projects.models import Project, SourceConfig
from trends.models import (
    ContentClusterMembership,
    OriginalContentIdea,
    OriginalContentIdeaStatus,
    SourceDiversitySnapshot,
    ThemeSuggestion,
    ThemeSuggestionStatus,
    TopicCentroidSnapshot,
    TopicCluster,
    TrendTaskRun,
    TrendTaskRunStatus,
    TopicVelocitySnapshot,
)
from trends.tasks import (
    ORIGINAL_CONTENT_IDEA_WEEKLY_CAP,
    TOPIC_CENTROID_MIN_UPVOTES,
    accept_theme_suggestion,
    assign_content_to_topic_cluster,
    generate_original_content_ideas,
    generate_theme_suggestions,
    mark_original_content_idea_written,
    queue_topic_centroid_recompute,
    recompute_source_diversity,
    recompute_topic_centroid,
    recompute_topic_clusters,
    recompute_topic_velocity,
    run_all_topic_centroid_recomputations,
    run_all_topic_cluster_recomputations,
)

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
        username="plugin-owner",
        password="testpass123",
    )
    project = Project.objects.create(name="Plugin Project", topic_description="Infra")
    entity = Entity.objects.create(
        project=project,
        name="Example",
        type="vendor",
        website_url="https://example.com",
    )
    return SimpleNamespace(user=user, project=project, entity=entity)


def test_recompute_topic_centroid_upserts_weighted_normalized_centroid(
    source_plugin_context, mocker
):
    project = source_plugin_context.project
    mocker.patch("content.signals.queue_topic_centroid_recompute")
    upsert_mock = mocker.patch("trends.tasks.upsert_topic_centroid")
    delete_mock = mocker.patch("trends.tasks.delete_topic_centroid")
    mocker.patch("trends.tasks.embed_text", return_value=[1.0, -0.25])

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
        username="downvote-owner",
        password="testpass123",
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
    mocker.patch("content.signals.queue_topic_centroid_recompute")
    upsert_mock = mocker.patch("trends.tasks.upsert_topic_centroid")
    delete_mock = mocker.patch("trends.tasks.delete_topic_centroid")
    mocker.patch("trends.tasks.embed_text", return_value=[1.0, 0.0])

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
    mocker.patch("content.signals.queue_topic_centroid_recompute")
    upsert_mock = mocker.patch("trends.tasks.upsert_topic_centroid")
    delete_mock = mocker.patch("trends.tasks.delete_topic_centroid")
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


def test_run_all_topic_centroid_recomputations_enqueues_all_projects(
    source_plugin_context, mocker
):
    delay_mock = mocker.patch("trends.tasks.recompute_topic_centroid.delay")
    other_project = Project.objects.create(
        name="Other Centroid Project",
        topic_description="Security",
    )

    enqueued_count = run_all_topic_centroid_recomputations()

    assert enqueued_count == 2
    delay_mock.assert_any_call(source_plugin_context.project.id)
    delay_mock.assert_any_call(_require_pk(other_project))
    assert delay_mock.call_count == 2


def test_run_all_topic_centroid_recomputations_executes_inline_when_eager(
    source_plugin_context, settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    recompute_mock = mocker.patch("trends.tasks.recompute_topic_centroid")
    delay_mock = mocker.patch("trends.tasks.recompute_topic_centroid.delay")
    other_project = Project.objects.create(
        name="Inline Centroid Project",
        topic_description="Platform",
    )

    enqueued_count = run_all_topic_centroid_recomputations()

    assert enqueued_count == 2
    recompute_mock.assert_any_call(source_plugin_context.project.id)
    recompute_mock.assert_any_call(_require_pk(other_project))
    assert recompute_mock.call_count == 2
    delay_mock.assert_not_called()


def test_run_all_topic_cluster_recomputations_enqueues_all_projects(
    source_plugin_context, mocker
):
    delay_mock = mocker.patch("trends.tasks.recompute_topic_clusters.delay")
    other_project = Project.objects.create(
        name="Other Cluster Project",
        topic_description="Security",
    )

    enqueued_count = run_all_topic_cluster_recomputations()

    assert enqueued_count == 2
    delay_mock.assert_any_call(source_plugin_context.project.id)
    delay_mock.assert_any_call(_require_pk(other_project))
    assert delay_mock.call_count == 2


def test_recompute_source_diversity_persists_entropy_breakdown_and_alerts(
    source_plugin_context,
):
    project = source_plugin_context.project
    rss_source = SourceConfig.objects.create(
        project=project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    reddit_source = SourceConfig.objects.create(
        project=project,
        plugin_name=SourcePluginName.REDDIT,
        config={"subreddit": "MachineLearning"},
    )
    first_cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at="2026-04-20T00:00:00Z",
        last_seen_at="2026-04-24T00:00:00Z",
        is_active=True,
        member_count=3,
        dominant_entity=source_plugin_context.entity,
        label="Platform Signals",
    )
    second_cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at="2026-04-20T00:00:00Z",
        last_seen_at="2026-04-24T00:00:00Z",
        is_active=True,
        member_count=1,
        dominant_entity=source_plugin_context.entity,
        label="Community Chatter",
    )

    contents = []
    for index in range(3):
        contents.append(
            Content.objects.create(
                project=project,
                entity=source_plugin_context.entity,
                url=f"https://example.com/rss-{index}",
                title=f"RSS {index}",
                author="Author",
                source_plugin=SourcePluginName.RSS,
                published_date="2026-04-24T12:00:00Z",
                content_text="Manual content body",
                source_metadata={"source_config_id": _require_pk(rss_source)},
            )
        )
    contents.append(
        Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url="https://example.com/reddit-0",
            title="Reddit 0",
            author="Author",
            source_plugin=SourcePluginName.REDDIT,
            published_date="2026-04-24T12:00:00Z",
            content_text="Manual content body",
            source_metadata={"source_config_id": _require_pk(reddit_source)},
        )
    )
    for content in contents[:3]:
        ContentClusterMembership.objects.create(
            content=content,
            cluster=first_cluster,
            project=project,
            similarity=0.95,
        )
    ContentClusterMembership.objects.create(
        content=contents[3],
        cluster=second_cluster,
        project=project,
        similarity=0.91,
    )

    result = recompute_source_diversity(_require_pk(project))
    snapshot = SourceDiversitySnapshot.objects.get(project=project)

    assert result["project_id"] == _require_pk(project)
    assert result["content_count"] == 4
    assert snapshot.window_days == 14
    assert snapshot.plugin_entropy == pytest.approx(0.811278, rel=1e-4)
    assert snapshot.source_entropy == pytest.approx(0.811278, rel=1e-4)
    assert snapshot.author_entropy == 0.0
    assert snapshot.cluster_entropy == pytest.approx(0.811278, rel=1e-4)
    assert snapshot.top_plugin_share == pytest.approx(0.75)
    assert snapshot.top_source_share == pytest.approx(0.75)
    assert snapshot.breakdown["plugin_counts"][0]["key"] == SourcePluginName.RSS
    assert snapshot.breakdown["plugin_counts"][0]["count"] == 3
    assert snapshot.breakdown["source_counts"][0]["label"] == (
        f"rss #{_require_pk(rss_source)}"
    )
    assert snapshot.breakdown["cluster_counts"][0]["label"] == "Platform Signals"
    assert snapshot.breakdown["alerts"] == [
        {
            "code": "top_plugin_share",
            "severity": "warning",
            "message": "Your stream is 75% from rss this week.",
        },
        {
            "code": "author_entropy",
            "severity": "warning",
            "message": "Three authors account for most of your content.",
        },
    ]


def test_recompute_source_diversity_records_skipped_trend_task_run_for_empty_window(
    source_plugin_context,
):
    project = source_plugin_context.project

    result = recompute_source_diversity(_require_pk(project))

    task_run = TrendTaskRun.objects.get(
        project=project,
        task_name="recompute_source_diversity",
    )
    assert result["content_count"] == 0
    assert task_run.status == TrendTaskRunStatus.SKIPPED
    assert task_run.finished_at is not None
    assert task_run.latency_ms is not None
    assert task_run.summary == {
        "project_id": _require_pk(project),
        "snapshot_id": _require_pk(
            SourceDiversitySnapshot.objects.get(project=project)
        ),
        "content_count": 0,
        "alert_count": 0,
    }


def test_recompute_topic_centroid_records_failed_trend_task_run(
    source_plugin_context, mocker
):
    project = source_plugin_context.project
    mocker.patch("content.signals.queue_topic_centroid_recompute")
    mocker.patch("trends.tasks.delete_topic_centroid")
    mocker.patch("trends.tasks.embed_text", side_effect=RuntimeError("embed failed"))

    for index in range(TOPIC_CENTROID_MIN_UPVOTES):
        content = Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url=f"https://example.com/failing-centroid-{index}",
            title=f"Failing centroid {index}",
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

    with pytest.raises(RuntimeError, match="embed failed"):
        recompute_topic_centroid(_require_pk(project))

    task_run = TrendTaskRun.objects.get(
        project=project,
        task_name="recompute_topic_centroid",
    )
    assert task_run.status == TrendTaskRunStatus.FAILED
    assert task_run.error_message == "embed failed"
    assert task_run.finished_at is not None
    assert task_run.summary == {}


def test_generate_original_content_ideas_creates_grounded_pending_idea(
    source_plugin_context,
):
    project = source_plugin_context.project
    source_plugin_context.entity.authority_score = 0.3
    source_plugin_context.entity.save(update_fields=["authority_score"])
    cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at="2026-04-20T00:00:00Z",
        last_seen_at="2026-04-24T00:00:00Z",
        is_active=True,
        member_count=3,
        dominant_entity=source_plugin_context.entity,
        label="Authoritative Gap",
    )
    TopicVelocitySnapshot.objects.create(
        cluster=cluster,
        project=project,
        window_count=5,
        trailing_mean=1.0,
        trailing_stddev=0.5,
        z_score=2.1,
        velocity_score=0.88,
    )
    contents = []
    for index in range(3):
        content = Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url=f"https://example.com/idea-{index}",
            title=f"Idea source {index}",
            author="Author",
            source_plugin=SourcePluginName.RSS,
            published_date="2026-04-24T12:00:00Z",
            content_text="Clusterable trend content with room for analysis.",
        )
        contents.append(content)
        ContentClusterMembership.objects.create(
            content=content,
            cluster=cluster,
            project=project,
            similarity=0.95 - (index * 0.01),
        )

    result = generate_original_content_ideas(_require_pk(project))
    idea = OriginalContentIdea.objects.get(project=project)

    assert result["created"] == 1
    assert idea.status == OriginalContentIdeaStatus.PENDING
    assert idea.related_cluster == cluster
    assert idea.generated_by_model == "heuristic-original-content-ideation"
    assert idea.self_critique_score >= 0.6
    assert list(
        idea.supporting_contents.order_by("id").values_list("id", flat=True)
    ) == [_require_pk(content) for content in contents]
    assert "Authoritative Gap" in idea.summary
    assert "velocity" in idea.why_now.lower()


def test_generate_original_content_ideas_enforces_weekly_cap_and_written_workflow(
    source_plugin_context,
    django_user_model,
):
    project = source_plugin_context.project
    editor = django_user_model.objects.create_user(
        username="idea-editor",
        password="testpass123",
    )
    for index in range(ORIGINAL_CONTENT_IDEA_WEEKLY_CAP):
        OriginalContentIdea.objects.create(
            project=project,
            angle_title=f"Existing idea {index}",
            summary="Summary",
            suggested_outline="Outline",
            why_now="Why now",
            generated_by_model="heuristic",
            self_critique_score=0.7,
        )

    capped_result = generate_original_content_ideas(_require_pk(project))

    accepted_idea = OriginalContentIdea.objects.create(
        project=project,
        angle_title="Accepted idea",
        summary="Summary",
        suggested_outline="Outline",
        why_now="Why now",
        generated_by_model="heuristic",
        self_critique_score=0.8,
        status=OriginalContentIdeaStatus.ACCEPTED,
    )
    mark_original_content_idea_written(accepted_idea, user_id=_require_pk(editor))
    accepted_idea.refresh_from_db()

    assert capped_result["created"] == 0
    assert capped_result["clusters_considered"] == 0
    assert accepted_idea.status == OriginalContentIdeaStatus.WRITTEN
    assert accepted_idea.decided_by == editor
    assert accepted_idea.decided_at is not None


def test_queue_topic_centroid_recompute_enqueues_background_task(
    source_plugin_context, mocker
):
    cache_add_mock = mocker.patch("trends.tasks.cache.add", return_value=True)
    delay_mock = mocker.patch("trends.tasks.recompute_topic_centroid.delay")

    queued = queue_topic_centroid_recompute(source_plugin_context.project.id)

    assert queued is True
    cache_add_mock.assert_called_once()
    delay_mock.assert_called_once_with(source_plugin_context.project.id)


def test_queue_topic_centroid_recompute_skips_duplicate_queue_attempts(
    source_plugin_context, mocker
):
    mocker.patch("trends.tasks.cache.add", return_value=False)
    delay_mock = mocker.patch("trends.tasks.recompute_topic_centroid.delay")

    queued = queue_topic_centroid_recompute(source_plugin_context.project.id)

    assert queued is False
    delay_mock.assert_not_called()


def test_recompute_topic_clusters_groups_recent_similar_content(
    source_plugin_context, mocker
):
    project = source_plugin_context.project
    second_entity = Entity.objects.create(
        project=project,
        name="Secondary Entity",
        type="vendor",
    )
    vector_lookup = {
        "Trend 1": [1.0, 0.0],
        "Trend 2": [0.99, 0.01],
        "Trend 3": [0.98, 0.02],
        "Trend 4": [0.97, 0.03],
        "Outlier": [0.0, 1.0],
    }
    mocker.patch(
        "trends.tasks.embed_text",
        side_effect=lambda text: vector_lookup[text.split("\n\n", 1)[0]],
    )
    delay_mock = mocker.patch("trends.tasks.recompute_topic_velocity.delay")

    clustered_contents = []
    for index in range(4):
        content = Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url=f"https://example.com/trend-{index}",
            title=f"Trend {index + 1}",
            author="Author",
            source_plugin=SourcePluginName.RSS,
            published_date=f"2026-04-2{index}T12:00:00Z",
            content_text="Clusterable trend content",
        )
        clustered_contents.append(content)
        EntityMention.objects.create(
            project=project,
            content=content,
            entity=source_plugin_context.entity,
            role=EntityMentionRole.SUBJECT,
        )
    outlier = Content.objects.create(
        project=project,
        entity=second_entity,
        url="https://example.com/outlier",
        title="Outlier",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-24T12:00:00Z",
        content_text="Outlier trend content",
    )

    result = recompute_topic_clusters(project.id)

    cluster = TopicCluster.objects.get(project=project, is_active=True)
    memberships = list(
        ContentClusterMembership.objects.filter(cluster=cluster).values_list(
            "content_id", flat=True
        )
    )

    assert result["contents_considered"] == 5
    assert result["clusters_updated"] == 1
    assert cluster.member_count == 4
    assert cluster.dominant_entity == source_plugin_context.entity
    assert set(memberships) == {_require_pk(content) for content in clustered_contents}
    assert _require_pk(outlier) not in memberships
    delay_mock.assert_called_once_with(project.id)


def test_assign_content_to_topic_cluster_adds_similar_content_to_existing_cluster(
    source_plugin_context, mocker
):
    project = source_plugin_context.project
    vector_lookup = {
        "Cluster 1": [1.0, 0.0],
        "Cluster 2": [0.99, 0.01],
        "Cluster 3": [0.98, 0.02],
        "Candidate": [0.97, 0.03],
    }
    mocker.patch(
        "trends.tasks.embed_text",
        side_effect=lambda text: vector_lookup[text.split("\n\n", 1)[0]],
    )

    existing_contents = []
    for index in range(3):
        content = Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url=f"https://example.com/cluster-{index}",
            title=f"Cluster {index + 1}",
            author="Author",
            source_plugin=SourcePluginName.RSS,
            published_date=f"2026-04-2{index}T12:00:00Z",
            content_text="Existing cluster content",
        )
        existing_contents.append(content)
    cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
        last_seen_at=datetime(2026, 4, 22, 12, 0, tzinfo=timezone.utc),
        is_active=True,
        member_count=3,
        dominant_entity=source_plugin_context.entity,
    )
    ContentClusterMembership.objects.bulk_create(
        [
            ContentClusterMembership(
                content=content,
                cluster=cluster,
                project=project,
                similarity=0.9,
            )
            for content in existing_contents
        ]
    )
    candidate = Content.objects.create(
        project=project,
        entity=source_plugin_context.entity,
        url="https://example.com/candidate",
        title="Candidate",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-24T12:00:00Z",
        content_text="New similar cluster content",
    )

    result = assign_content_to_topic_cluster(_require_pk(candidate))

    cluster.refresh_from_db()
    membership = ContentClusterMembership.objects.get(content=candidate)
    assert result["assigned"] is True
    assert result["cluster_id"] == _require_pk(cluster)
    assert membership.cluster == cluster
    assert cluster.member_count == 4
    assert cluster.is_active is True


def test_recompute_topic_velocity_detects_synthetic_burst(
    source_plugin_context, mocker
):
    project = source_plugin_context.project
    fixed_now = datetime(2026, 4, 30, 12, 0, tzinfo=timezone.utc)
    mocker.patch("trends.tasks.timezone.now", return_value=fixed_now)
    cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at=fixed_now - timedelta(days=8),
        last_seen_at=fixed_now,
        is_active=True,
        member_count=11,
        dominant_entity=source_plugin_context.entity,
    )

    membership_rows = []
    for offset in range(1, 8):
        content = Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url=f"https://example.com/baseline-{offset}",
            title=f"Baseline {offset}",
            author="Author",
            source_plugin=SourcePluginName.RSS,
            published_date=fixed_now - timedelta(days=offset, hours=1),
            content_text="Baseline trend content",
        )
        membership_rows.append(
            ContentClusterMembership(
                content=content,
                cluster=cluster,
                project=project,
                similarity=0.9,
            )
        )
    for index in range(4):
        content = Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url=f"https://example.com/burst-{index}",
            title=f"Burst {index}",
            author="Author",
            source_plugin=SourcePluginName.RSS,
            published_date=fixed_now - timedelta(hours=index + 1),
            content_text="Burst trend content",
        )
        membership_rows.append(
            ContentClusterMembership(
                content=content,
                cluster=cluster,
                project=project,
                similarity=0.95,
            )
        )
    ContentClusterMembership.objects.bulk_create(membership_rows)

    result = recompute_topic_velocity(project.id)

    snapshot = TopicVelocitySnapshot.objects.get(cluster=cluster)
    assert result["clusters_evaluated"] == 1
    assert result["snapshots_created"] == 1
    assert snapshot.window_count == 4
    assert snapshot.trailing_mean == pytest.approx(1.0)
    assert snapshot.trailing_stddev == pytest.approx(0.0)
    assert snapshot.z_score == pytest.approx(3.0)
    assert snapshot.velocity_score == pytest.approx(1.0)


def test_generate_theme_suggestions_creates_pending_suggestion(
    source_plugin_context, settings, mocker
):
    settings.OPENROUTER_API_KEY = "test-key"
    project = source_plugin_context.project
    cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
        last_seen_at=datetime(2026, 4, 24, 12, 0, tzinfo=timezone.utc),
        is_active=True,
        member_count=3,
        dominant_entity=source_plugin_context.entity,
    )
    content = Content.objects.create(
        project=project,
        entity=source_plugin_context.entity,
        url="https://example.com/theme-source",
        title="Theme Source",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-24T12:00:00Z",
        content_text="Theme source content",
    )
    ContentClusterMembership.objects.create(
        content=content,
        cluster=cluster,
        project=project,
        similarity=0.95,
    )
    TopicVelocitySnapshot.objects.create(
        cluster=cluster,
        project=project,
        window_count=4,
        trailing_mean=1.0,
        trailing_stddev=0.0,
        z_score=3.0,
        velocity_score=1.0,
    )
    llm_mock = mocker.patch(
        "trends.tasks.openrouter_chat_json",
        side_effect=[
            SimpleNamespace(
                payload={
                    "title": "Platform teams are consolidating around one workflow",
                    "one_sentence_pitch": "A burst of similar coverage suggests a coherent newsletter theme.",
                    "why_it_matters": "Editors can turn the cluster into a timely section.",
                    "suggested_angle": "Explain what changed this week.",
                },
                model=settings.AI_SUMMARIZATION_MODEL,
                latency_ms=123,
            ),
            SimpleNamespace(
                payload={"novelty_score": 0.91, "explanation": "Novel enough."},
                model=settings.AI_RELEVANCE_MODEL,
                latency_ms=98,
            ),
        ],
    )

    result = generate_theme_suggestions(project.id)

    suggestion = ThemeSuggestion.objects.get(project=project, cluster=cluster)
    assert result["created"] == 1
    assert suggestion.status == ThemeSuggestionStatus.PENDING
    assert suggestion.title == "Platform teams are consolidating around one workflow"
    assert suggestion.novelty_score == pytest.approx(0.91)
    assert suggestion.velocity_at_creation == pytest.approx(1.0)
    assert llm_mock.call_count == 2


def test_generate_theme_suggestions_updates_existing_pending_for_same_cluster(
    source_plugin_context,
):
    project = source_plugin_context.project
    cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
        last_seen_at=datetime(2026, 4, 24, 12, 0, tzinfo=timezone.utc),
        is_active=True,
        member_count=3,
        dominant_entity=source_plugin_context.entity,
    )
    TopicVelocitySnapshot.objects.create(
        cluster=cluster,
        project=project,
        window_count=4,
        trailing_mean=1.0,
        trailing_stddev=0.0,
        z_score=3.0,
        velocity_score=0.88,
    )
    suggestion = ThemeSuggestion.objects.create(
        project=project,
        cluster=cluster,
        title="Existing pending theme",
        pitch="Pitch",
        why_it_matters="Why",
        suggested_angle="Angle",
        velocity_at_creation=0.2,
        novelty_score=0.8,
    )

    result = generate_theme_suggestions(project.id)

    suggestion.refresh_from_db()
    assert result["created"] == 0
    assert result["updated"] == 1
    assert ThemeSuggestion.objects.filter(project=project, cluster=cluster).count() == 1
    assert suggestion.velocity_at_creation == pytest.approx(0.88)


def test_accept_theme_suggestion_marks_cluster_members_for_newsletter_promotion(
    source_plugin_context,
):
    project = source_plugin_context.project
    cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at=datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc),
        last_seen_at=datetime(2026, 4, 24, 12, 0, tzinfo=timezone.utc),
        is_active=True,
        member_count=2,
        dominant_entity=source_plugin_context.entity,
    )
    primary_content = Content.objects.create(
        project=project,
        entity=source_plugin_context.entity,
        url="https://example.com/promote-1",
        title="Promoted One",
        author="Author",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-24T12:00:00Z",
        content_text="Primary theme content",
    )
    secondary_content = Content.objects.create(
        project=project,
        entity=source_plugin_context.entity,
        url="https://example.com/promote-2",
        title="Promoted Two",
        author="Author",
        source_plugin=SourcePluginName.REDDIT,
        published_date="2026-04-24T13:00:00Z",
        content_text="Secondary theme content",
    )
    ContentClusterMembership.objects.bulk_create(
        [
            ContentClusterMembership(
                content=primary_content,
                cluster=cluster,
                project=project,
                similarity=0.95,
            ),
            ContentClusterMembership(
                content=secondary_content,
                cluster=cluster,
                project=project,
                similarity=0.9,
            ),
        ]
    )
    suggestion = ThemeSuggestion.objects.create(
        project=project,
        cluster=cluster,
        title="Accepted Theme",
        pitch="Pitch",
        why_it_matters="Why",
        suggested_angle="Angle",
        velocity_at_creation=0.7,
        novelty_score=0.8,
    )

    accept_theme_suggestion(suggestion, user_id=source_plugin_context.user.id)

    suggestion.refresh_from_db()
    primary_content.refresh_from_db()
    secondary_content.refresh_from_db()
    assert suggestion.status == ThemeSuggestionStatus.ACCEPTED
    assert primary_content.newsletter_promotion_theme == suggestion
    assert secondary_content.newsletter_promotion_theme == suggestion
    assert primary_content.newsletter_promotion_by == source_plugin_context.user
    assert secondary_content.newsletter_promotion_by == source_plugin_context.user
    assert primary_content.newsletter_promotion_at is not None
    assert secondary_content.newsletter_promotion_at is not None
