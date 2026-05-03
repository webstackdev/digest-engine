from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.db.models import Model
from django.utils import timezone

from content.models import Content, FeedbackType, UserFeedback
from core.pipeline import RELEVANCE_SKILL_NAME, SUMMARIZATION_SKILL_NAME
from core.tasks import (
    apply_retention_policies,
    queue_content_skill,
    recompute_authority_scores,
    run_all_authority_recomputations,
    run_all_retention_policies,
    run_all_source_quality_recomputations,
    run_relevance_scoring_skill,
    run_summarization_skill,
)
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityMention,
    EntityMentionRole,
)
from pipeline.models import ReviewQueue, ReviewReason, ReviewResolution, SkillStatus
from projects.model_support import SourcePluginName
from projects.models import Project, ProjectConfig
from trends.models import (
    SourceDiversitySnapshot,
    TopicCentroidSnapshot,
    TopicCluster,
    TopicVelocitySnapshot,
    TrendTaskRun,
    TrendTaskRunStatus,
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
    delay_mock.assert_any_call(_require_pk(other_project))
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
    recompute_mock.assert_any_call(_require_pk(other_project))
    assert recompute_mock.call_count == 2
    delay_mock.assert_not_called()


def test_run_all_source_quality_recomputations_enqueues_all_projects(
    source_plugin_context, mocker
):
    delay_mock = mocker.patch("core.tasks.recompute_source_quality.delay")
    other_project = Project.objects.create(
        name="Source Quality Project",
        topic_description="Signals",
    )

    enqueued_count = run_all_source_quality_recomputations()

    assert enqueued_count == 2
    delay_mock.assert_any_call(source_plugin_context.project.id)
    delay_mock.assert_any_call(_require_pk(other_project))
    assert delay_mock.call_count == 2


def test_run_all_source_quality_recomputations_executes_inline_when_eager(
    source_plugin_context, settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    recompute_mock = mocker.patch("core.tasks.recompute_source_quality")
    delay_mock = mocker.patch("core.tasks.recompute_source_quality.delay")
    other_project = Project.objects.create(
        name="Inline Source Quality Project",
        topic_description="Signals",
    )

    enqueued_count = run_all_source_quality_recomputations()

    assert enqueued_count == 2
    recompute_mock.assert_any_call(source_plugin_context.project.id)
    recompute_mock.assert_any_call(_require_pk(other_project))
    assert recompute_mock.call_count == 2
    delay_mock.assert_not_called()


def test_run_all_retention_policies_enqueues_all_projects(
    source_plugin_context, mocker
):
    delay_mock = mocker.patch("core.tasks.apply_retention_policies.delay")
    other_project = Project.objects.create(
        name="Retention Project",
        topic_description="Ops",
    )

    enqueued_count = run_all_retention_policies()

    assert enqueued_count == 2
    delay_mock.assert_any_call(source_plugin_context.project.id)
    delay_mock.assert_any_call(_require_pk(other_project))
    assert delay_mock.call_count == 2


def test_apply_retention_policies_deletes_old_observability_records(
    source_plugin_context,
):
    project = source_plugin_context.project
    review_content = Content.objects.create(
        project=project,
        entity=source_plugin_context.entity,
        url="https://example.com/retention-review",
        canonical_url="https://example.com/retention-review",
        title="Retention Review",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-28T12:00:00Z",
        content_text="Needs review retention coverage.",
    )
    cluster = TopicCluster.objects.create(
        project=project,
        label="Ops cluster",
        first_seen_at=timezone.now(),
        last_seen_at=timezone.now(),
        is_active=True,
        member_count=1,
    )
    old_centroid = TopicCentroidSnapshot.objects.create(
        project=project,
        centroid_active=True,
        centroid_vector=[1.0, 0.0],
        feedback_count=5,
        upvote_count=4,
        downvote_count=1,
    )
    kept_centroid = TopicCentroidSnapshot.objects.create(
        project=project,
        centroid_active=True,
        centroid_vector=[0.0, 1.0],
        feedback_count=6,
        upvote_count=5,
        downvote_count=1,
    )
    old_velocity = TopicVelocitySnapshot.objects.create(
        project=project,
        cluster=cluster,
        window_count=3,
        trailing_mean=1.0,
        trailing_stddev=0.3,
        z_score=1.5,
        velocity_score=0.8,
    )
    kept_velocity = TopicVelocitySnapshot.objects.create(
        project=project,
        cluster=cluster,
        window_count=4,
        trailing_mean=1.1,
        trailing_stddev=0.2,
        z_score=1.7,
        velocity_score=0.9,
    )
    old_diversity = SourceDiversitySnapshot.objects.create(
        project=project,
        plugin_entropy=0.5,
        source_entropy=0.6,
        author_entropy=0.7,
        cluster_entropy=0.4,
        top_plugin_share=0.8,
        top_source_share=0.75,
    )
    kept_diversity = SourceDiversitySnapshot.objects.create(
        project=project,
        plugin_entropy=0.8,
        source_entropy=0.85,
        author_entropy=0.82,
        cluster_entropy=0.7,
        top_plugin_share=0.35,
        top_source_share=0.32,
    )
    old_authority_snapshot = EntityAuthoritySnapshot.objects.create(
        entity=source_plugin_context.entity,
        project=project,
        mention_component=0.5,
        engagement_component=0.4,
        recency_component=0.3,
        source_quality_component=0.2,
        cross_newsletter_component=0.1,
        feedback_component=0.6,
        duplicate_component=0.2,
        decayed_prior=0.5,
        final_score=0.55,
    )
    kept_authority_snapshot = EntityAuthoritySnapshot.objects.create(
        entity=source_plugin_context.entity,
        project=project,
        mention_component=0.7,
        engagement_component=0.6,
        recency_component=0.5,
        source_quality_component=0.4,
        cross_newsletter_component=0.2,
        feedback_component=0.7,
        duplicate_component=0.1,
        decayed_prior=0.55,
        final_score=0.68,
    )
    old_trend_run = TrendTaskRun.objects.create(
        project=project,
        task_name="recompute_topic_centroid",
        status=TrendTaskRunStatus.COMPLETED,
        latency_ms=100,
        summary={"project_id": _require_pk(project)},
    )
    kept_trend_run = TrendTaskRun.objects.create(
        project=project,
        task_name="recompute_topic_velocity",
        status=TrendTaskRunStatus.COMPLETED,
        latency_ms=80,
        summary={"project_id": _require_pk(project)},
    )
    old_review_item = ReviewQueue.objects.create(
        project=project,
        content=review_content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        confidence=0.55,
        resolved=True,
        resolution=ReviewResolution.ARCHIVED,
    )
    kept_review_item = ReviewQueue.objects.create(
        project=project,
        content=Content.objects.create(
            project=project,
            entity=source_plugin_context.entity,
            url="https://example.com/retention-review-keep",
            canonical_url="https://example.com/retention-review-keep",
            title="Retention Review Keep",
            author="Editor",
            source_plugin=SourcePluginName.RSS,
            published_date="2026-04-29T12:00:00Z",
            content_text="Recent review item.",
        ),
        reason=ReviewReason.RETRY_EXHAUSTED,
        confidence=0.3,
        resolved=True,
        resolution=ReviewResolution.MANUALLY_RESOLVED,
        resolved_at=timezone.now(),
    )

    old_timestamp = timezone.now() - timedelta(days=120)
    TopicCentroidSnapshot.objects.filter(pk=old_centroid.pk).update(
        computed_at=old_timestamp
    )
    TopicVelocitySnapshot.objects.filter(pk=old_velocity.pk).update(
        computed_at=old_timestamp
    )
    SourceDiversitySnapshot.objects.filter(pk=old_diversity.pk).update(
        computed_at=old_timestamp
    )
    EntityAuthoritySnapshot.objects.filter(pk=old_authority_snapshot.pk).update(
        computed_at=old_timestamp
    )
    TrendTaskRun.objects.filter(pk=old_trend_run.pk).update(
        started_at=old_timestamp,
        finished_at=old_timestamp,
    )
    ReviewQueue.objects.filter(pk=old_review_item.pk).update(resolved_at=old_timestamp)

    result = apply_retention_policies(_require_pk(project))

    assert result["deleted"]["topic_centroid_snapshots"] == 1
    assert result["deleted"]["topic_velocity_snapshots"] == 1
    assert result["deleted"]["source_diversity_snapshots"] == 1
    assert result["deleted"]["entity_authority_snapshots"] == 1
    assert result["deleted"]["trend_task_runs"] == 1
    assert result["deleted"]["resolved_review_items"] == 1
    assert TopicCentroidSnapshot.objects.filter(pk=kept_centroid.pk).exists()
    assert TopicVelocitySnapshot.objects.filter(pk=kept_velocity.pk).exists()
    assert SourceDiversitySnapshot.objects.filter(pk=kept_diversity.pk).exists()
    assert EntityAuthoritySnapshot.objects.filter(
        pk=kept_authority_snapshot.pk
    ).exists()
    assert TrendTaskRun.objects.filter(pk=kept_trend_run.pk).exists()
    assert ReviewQueue.objects.filter(pk=kept_review_item.pk).exists()


def test_recompute_authority_scores_updates_entities_and_creates_snapshots(
    source_plugin_context, mocker
):
    mocker.patch("content.signals.queue_topic_centroid_recompute")
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
        canonical_url="https://example.com/authority-primary",
        title="Authority Primary",
        author="Reporter",
        source_plugin="linkedin",
        published_date="2026-04-28T12:00:00Z",
        content_text="Primary authority content.",
        duplicate_signal_count=3,
        source_metadata={"like_count": 9, "comment_count": 3, "share_count": 2},
    )
    secondary_content = Content.objects.create(
        project=project,
        entity=secondary_entity,
        url="https://example.com/authority-secondary",
        canonical_url="https://example.com/authority-secondary",
        title="Authority Secondary",
        author="Reporter",
        source_plugin=SourcePluginName.RSS,
        published_date="2026-04-28T13:00:00Z",
        content_text="Secondary authority content.",
    )
    corroborating_project = Project.objects.create(
        name="Corroborating Project",
        topic_description="Newsletter coverage",
    )
    Content.objects.create(
        project=corroborating_project,
        url="https://example.com/newsletter-primary",
        canonical_url=primary_content.canonical_url,
        title="Authority Primary Mention",
        author="newsletter@example.com",
        source_plugin="newsletter",
        published_date="2026-04-28T14:00:00Z",
        content_text="Authority primary newsletter mention.",
        source_metadata={"sender_email": "newsletter@example.com"},
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
    assert (
        primary_snapshot.engagement_component > secondary_snapshot.engagement_component
    )
    assert primary_snapshot.recency_component > 0.8
    assert primary_snapshot.source_quality_component > 0.0
    assert (
        primary_snapshot.cross_newsletter_component
        > secondary_snapshot.cross_newsletter_component
    )
    assert primary_snapshot.feedback_component > 0.5
    assert primary_snapshot.duplicate_component > secondary_snapshot.duplicate_component
    assert primary_snapshot.decayed_prior == pytest.approx(
        config.authority_decay_rate * 0.5
    )
    assert primary_snapshot.weights_at_compute["engagement"] == pytest.approx(0.15)


def test_recompute_authority_scores_uses_bluesky_and_reddit_engagement_metadata(
    source_plugin_context, mocker
):
    mocker.patch("content.signals.queue_topic_centroid_recompute")
    project = source_plugin_context.project
    ProjectConfig.objects.create(project=project)
    entity = source_plugin_context.entity
    bluesky_content = Content.objects.create(
        project=project,
        entity=entity,
        url="https://bsky.app/profile/example/post/abc",
        canonical_url="https://bsky.app/profile/example/post/abc",
        title="Bluesky authority content",
        author="example.bsky.social",
        source_plugin=SourcePluginName.BLUESKY,
        published_date="2026-04-28T12:00:00Z",
        content_text="Bluesky authority content.",
        source_metadata={"like_count": 4, "reply_count": 1, "repost_count": 2},
    )
    reddit_content = Content.objects.create(
        project=project,
        entity=entity,
        url="https://www.reddit.com/r/python/comments/abc123/test",
        canonical_url="https://www.reddit.com/r/python/comments/abc123/test",
        title="Reddit authority content",
        author="redditor",
        source_plugin=SourcePluginName.REDDIT,
        published_date="2026-04-28T13:00:00Z",
        content_text="Reddit authority content.",
        source_metadata={"score": 10, "comment_count": 3},
    )
    EntityMention.objects.create(
        project=project,
        content=bluesky_content,
        entity=entity,
        role=EntityMentionRole.AUTHOR,
        sentiment="positive",
        span="Example",
        confidence=0.9,
    )
    EntityMention.objects.create(
        project=project,
        content=reddit_content,
        entity=entity,
        role=EntityMentionRole.AUTHOR,
        sentiment="neutral",
        span="Example",
        confidence=0.9,
    )

    recompute_authority_scores(project.id)

    snapshot = EntityAuthoritySnapshot.objects.get(entity=entity)
    assert snapshot.engagement_component == pytest.approx(1.0)


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
    delay_mock.assert_called_once_with(_require_pk(skill_result))


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
    task_mock.assert_called_once_with(_require_pk(skill_result))
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
    task_mock.assert_called_once_with(_require_pk(skill_result))
    delay_mock.assert_not_called()


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
    delay_mock.assert_called_once_with(_require_pk(pending_result))

    result = run_relevance_scoring_skill(_require_pk(pending_result))

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
    delay_mock.assert_called_once_with(_require_pk(pending_result))

    result = run_summarization_skill(_require_pk(pending_result))

    pending_result.refresh_from_db()
    assert result.status == SkillStatus.FAILED
    assert pending_result.status == SkillStatus.FAILED
    assert "Summarization requires relevance_score" in pending_result.error_message
