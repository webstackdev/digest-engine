from types import SimpleNamespace

import pytest
from django.db.models import Model

from content.models import Content, FeedbackType, UserFeedback
from core.pipeline import RELEVANCE_SKILL_NAME, SUMMARIZATION_SKILL_NAME
from core.tasks import (
    queue_content_skill,
    recompute_authority_scores,
    run_all_authority_recomputations,
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
from pipeline.models import SkillStatus
from projects.model_support import SourcePluginName
from projects.models import Project, ProjectConfig

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
