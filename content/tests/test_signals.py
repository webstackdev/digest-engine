from types import SimpleNamespace
from typing import Any, cast

import pytest

from content.models import Content, FeedbackType, UserFeedback
from entities.models import Entity
from projects.model_support import SourcePluginName
from projects.models import Project, ProjectConfig

pytestmark = pytest.mark.django_db


def _create_user(user_model: Any, **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


@pytest.fixture
def source_plugin_context(django_user_model):
    user = _create_user(
        django_user_model, username="plugin-owner", password="testpass123"
    )
    project = Project.objects.create(name="Plugin Project", topic_description="Infra")
    entity = Entity.objects.create(
        project=project,
        name="Example",
        type="vendor",
        website_url="https://example.com",
    )
    return SimpleNamespace(user=user, project=project, entity=entity)


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
    queue_mock = mocker.patch("content.signals.queue_topic_centroid_recompute")

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
    queue_mock = mocker.patch("content.signals.queue_topic_centroid_recompute")
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
    queue_mock = mocker.patch("content.signals.queue_topic_centroid_recompute")

    feedback = UserFeedback.objects.create(
        project=source_plugin_context.project,
        content=content,
        user=source_plugin_context.user,
        feedback_type=FeedbackType.UPVOTE,
    )
    feedback.feedback_type = FeedbackType.DOWNVOTE
    feedback.save(update_fields=["feedback_type"])

    queue_mock.assert_not_called()
