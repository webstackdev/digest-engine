from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import ANY, Mock

import pytest
from django.contrib import messages
from django.contrib.admin.sites import AdminSite
from django.db.models import Model
from django.http import HttpRequest
from django.test import RequestFactory
from django.utils import timezone

from content.models import Content
from pipeline.models import ReviewQueue, ReviewReason, ReviewResolution, SkillResult
from pipeline.admin import ReviewQueueAdmin, SkillResultAdmin
from projects.model_support import SourcePluginName
from projects.models import Project

pytestmark = pytest.mark.django_db


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed admin test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _create_user(user_model: Any, **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


def _request(query_params: dict[str, str] | None = None) -> HttpRequest:
    """Build a typed request object for admin actions and filters."""

    return RequestFactory().get("/admin/", data=query_params or {})


def _message_user_mock(admin_instance: Any, mocker: Any) -> Mock:
    """Install a mock for ModelAdmin.message_user and return it for assertions."""

    message_mock = cast(Mock, mocker.Mock())
    admin_instance.message_user = message_mock
    return message_mock


def _context(response: object) -> dict[str, Any]:
    """Cast admin changelist extra_context payloads for typed assertions."""

    return cast(dict[str, Any], response)


def _dashboard_stats(response: object) -> list[dict[str, Any]]:
    """Return typed dashboard stats rows from a changelist extra_context payload."""

    return cast(list[dict[str, Any]], _context(response)["dashboard_stats"])


@pytest.fixture
def source_admin_context(django_user_model):
    user = _create_user(
        django_user_model, username="admin-owner", password="testpass123"
    )
    project = Project.objects.create(name="Admin Project", topic_description="Infra")
    return SimpleNamespace(user=user, project=project)


def test_review_queue_changelist_view_builds_dashboard_stats(
    source_admin_context, mocker
):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/review-item",
        title="Review Item",
        author="Reviewer",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Review queue content",
    )
    ReviewQueue.objects.create(
        project=source_admin_context.project,
        content=content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        confidence=0.42,
        resolved=False,
    )
    admin_instance = ReviewQueueAdmin(ReviewQueue, AdminSite())
    mocker.patch.object(
        admin_instance, "get_queryset", return_value=ReviewQueue.objects.all()
    )
    super_changelist_view = mocker.patch(
        "pipeline.admin.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )

    response = admin_instance.changelist_view(request=_request())
    dashboard_stats = _dashboard_stats(response)

    super_changelist_view.assert_called_once()
    assert dashboard_stats[0]["value"] == 1
    assert dashboard_stats[1]["value"] == "42%"


def test_review_queue_display_confidence_renders_without_django6_format_error(
    source_admin_context,
):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/review-confidence",
        title="Review Confidence",
        author="Reviewer",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Review queue content",
    )
    review_item = ReviewQueue.objects.create(
        project=source_admin_context.project,
        content=content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        confidence=0.42,
        resolved=False,
    )
    admin_instance = ReviewQueueAdmin(ReviewQueue, AdminSite())

    rendered = admin_instance.display_confidence(review_item)

    assert "42%" in rendered


def test_skill_result_admin_helpers_and_dashboard_stats(source_admin_context, mocker):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/skill-result",
        title="Skill Result Title For Preview",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Skill result content.",
    )
    current_result = SkillResult.objects.create(
        content=content,
        project=source_admin_context.project,
        skill_name="summarization",
        status="FAILED",
        result_data={"summary": "Draft summary"},
        error_message="boom",
        latency_ms=1250,
        confidence=0.42,
    )
    superseded_result = SkillResult.objects.create(
        content=content,
        project=source_admin_context.project,
        skill_name="relevance_scoring",
        status="COMPLETED",
        result_data=None,
        latency_ms=250,
        confidence=0.91,
        superseded_by=current_result,
    )
    admin_instance = SkillResultAdmin(SkillResult, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)
    super_changelist_view = mocker.patch(
        "pipeline.admin.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )

    admin_instance.retry_selected_skills(
        _request(), SkillResult.objects.filter(pk=current_result.pk)
    )
    current_result.refresh_from_db()
    response = admin_instance.changelist_view(_request())
    dashboard_stats = _dashboard_stats(response)

    assert current_result.status == "pending"
    assert current_result.error_message == ""
    message_user_mock.assert_called_once_with(
        ANY,
        "Successfully reset 1 skills to PENDING for retry.",
        messages.SUCCESS,
    )
    assert (
        admin_instance.preview_json(current_result)
        == f'<a href="{current_result.pk}/change/" class="font-bold text-primary-600">🔍 Preview</a>'
    )
    assert admin_instance.preview_json(superseded_result) == "-"
    assert admin_instance.get_content_link(current_result).endswith("...")
    assert "● PENDING" in admin_instance.display_status(current_result)
    assert admin_instance.display_performance(current_result) == "1250ms / 42%"
    assert admin_instance.is_current(current_result) is True
    assert admin_instance.is_current(superseded_result) is False
    assert "Draft summary" in admin_instance.pretty_result_data(current_result)
    assert admin_instance.pretty_result_data(superseded_result) == "No data available"
    super_changelist_view.assert_called_once()
    assert dashboard_stats[0]["value"] == "750ms"
    assert dashboard_stats[1]["value"] == "0.0%"


def test_review_queue_actions_update_resolution_and_emit_message(
    source_admin_context, mocker
):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/review-action",
        title="Review Action",
        author="Reviewer",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Review action content.",
    )
    approve_item = ReviewQueue.objects.create(
        project=source_admin_context.project,
        content=content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        confidence=0.5,
        resolved=False,
    )
    reject_item = ReviewQueue.objects.create(
        project=source_admin_context.project,
        content=content,
        reason=ReviewReason.LOW_CONFIDENCE_CLASSIFICATION,
        confidence=0.2,
        resolved=False,
    )
    admin_instance = ReviewQueueAdmin(ReviewQueue, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.mark_as_approved(
        _request(), ReviewQueue.objects.filter(pk=approve_item.pk)
    )
    admin_instance.mark_as_rejected(
        _request(), ReviewQueue.objects.filter(pk=reject_item.pk)
    )

    approve_item.refresh_from_db()
    reject_item.refresh_from_db()
    assert approve_item.resolved is True
    assert approve_item.resolution == ReviewResolution.HUMAN_APPROVED
    assert approve_item.resolved_at is not None
    assert reject_item.resolved is True
    assert reject_item.resolution == ReviewResolution.HUMAN_REJECTED
    assert reject_item.resolved_at is not None
    assert message_user_mock.call_count == 2


def test_skill_result_admin_handles_unknown_status_and_empty_performance(
    source_admin_context,
):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/skill-result-empty",
        title="",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Skill result content.",
    )
    skill_result = SkillResult.objects.create(
        content=content,
        project=source_admin_context.project,
        skill_name="summarization",
        status="QUEUED",
        result_data={"summary": "Queued summary"},
        latency_ms=None,
        confidence=None,
    )
    admin_instance = SkillResultAdmin(SkillResult, AdminSite())

    assert admin_instance.get_content_link(skill_result) == "Untitled"
    assert "gray" in admin_instance.display_status(skill_result)
    assert admin_instance.display_performance(skill_result) == "- / -"


def test_skill_result_changelist_view_uses_warning_and_danger_colors(
    source_admin_context, mocker
):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/skill-result-slow",
        title="Slow Skill Result",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Slow skill result content.",
    )
    SkillResult.objects.create(
        content=content,
        project=source_admin_context.project,
        skill_name="summarization",
        status="failed",
        latency_ms=3001,
    )
    admin_instance = SkillResultAdmin(SkillResult, AdminSite())
    super_changelist_view = mocker.patch(
        "pipeline.admin.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )

    response = admin_instance.changelist_view(_request())
    dashboard_stats = _dashboard_stats(response)

    super_changelist_view.assert_called_once()
    assert dashboard_stats[0]["color"] == "warning"
    assert dashboard_stats[1]["color"] == "danger"


@pytest.mark.parametrize(
    ("confidence", "expected_color"),
    [
        (0.2, "red"),
        (0.9, "green"),
    ],
)
def test_review_queue_display_confidence_remaining_color_branches(
    source_admin_context,
    confidence,
    expected_color,
):
    content = Content.objects.create(
        project=source_admin_context.project,
        url=f"https://example.com/review-confidence-{confidence}",
        title="Review Confidence Remaining",
        author="Reviewer",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Review queue content",
    )
    review_item = ReviewQueue.objects.create(
        project=source_admin_context.project,
        content=content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        confidence=confidence,
        resolved=False,
    )
    admin_instance = ReviewQueueAdmin(ReviewQueue, AdminSite())

    rendered = admin_instance.display_confidence(review_item)

    assert expected_color in rendered
