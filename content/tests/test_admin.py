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

from content.admin import (
    ContentAdmin,
    DuplicateStateFilter,
    HighValueFilter,
    UserFeedbackAdmin,
)
from content.models import Content, UserFeedback
from pipeline.models import SkillResult
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


def _params(**kwargs: str) -> dict[str, list[str]]:
    """Build typed admin filter params."""

    return {key: [value] for key, value in kwargs.items()}


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


def test_content_preview_uses_content_text(source_admin_context):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-preview",
        title="Admin Preview",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="A short preview from the content body.",
    )
    admin_instance = ContentAdmin(Content, AdminSite())

    preview = admin_instance.preview_content(content)

    assert 'title="A short preview from the content body."' in preview


def test_content_preview_returns_dash_when_content_text_blank(source_admin_context):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-preview-empty",
        title="Admin Preview Empty",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="   ",
    )
    admin_instance = ContentAdmin(Content, AdminSite())

    assert admin_instance.preview_content(content) == "-"


def test_content_view_trace_prefers_external_trace_url(source_admin_context):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-trace",
        title="Admin Trace",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Trace content.",
    )
    SkillResult.objects.create(
        content=content,
        project=source_admin_context.project,
        skill_name="summarization",
        status="COMPLETED",
        result_data={"trace_url": "https://traces.example/run/123"},
    )
    admin_instance = ContentAdmin(Content, AdminSite())

    rendered = admin_instance.view_trace(content)

    assert "https://traces.example/run/123" in rendered
    assert "📈 Trace" in rendered


def test_content_view_trace_falls_back_to_skill_runs_changelist(source_admin_context):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-trace-fallback",
        title="Admin Trace Fallback",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Trace fallback content.",
    )
    SkillResult.objects.create(
        content=content,
        project=source_admin_context.project,
        skill_name="relevance_scoring",
        status="COMPLETED",
        result_data={"relevance_score": 0.9},
    )
    admin_instance = ContentAdmin(Content, AdminSite())

    rendered = admin_instance.view_trace(content)

    assert "🧠 Skill runs" in rendered
    assert f"content__id__exact={_require_pk(content)}" in rendered


def test_content_changelist_view_builds_dashboard_stats(source_admin_context, mocker):
    Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-dashboard-1",
        title="Admin Dashboard 1",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Content one.",
        relevance_score=0.8,
        authority_adjusted_score=0.85,
    )
    Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-dashboard-2",
        title="Admin Dashboard 2",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Content two.",
        relevance_score=0.4,
        authority_adjusted_score=0.45,
    )
    admin_instance = ContentAdmin(Content, AdminSite())
    mocker.patch.object(
        admin_instance, "get_queryset", return_value=Content.objects.all()
    )
    super_changelist_view = mocker.patch(
        "django.contrib.admin.options.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )

    response = admin_instance.changelist_view(request=_request())
    dashboard_stats = _dashboard_stats(response)

    super_changelist_view.assert_called_once()
    assert dashboard_stats[0]["value"] == "60.0%"
    assert dashboard_stats[1]["value"] == "65.0%"
    assert dashboard_stats[2]["value"] == 2


def test_content_admin_score_columns_render_expected_values(source_admin_context):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-scores",
        title="Admin Scores",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Score rendering content.",
        relevance_score=0.8,
        authority_adjusted_score=0.86,
    )
    admin_instance = ContentAdmin(Content, AdminSite())

    rendered_base = admin_instance.display_relevance(content)
    rendered_adjusted = admin_instance.display_authority_adjusted_score(content)

    assert "80.0%" in rendered_base
    assert "green" in rendered_base
    assert "86.0%" in rendered_adjusted
    assert "green" in rendered_adjusted


def test_generate_newsletter_ideas_queues_selected_content(
    source_admin_context, mocker
):
    first_content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-queue-1",
        title="Admin Queue 1",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Queue one.",
    )
    second_content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-queue-2",
        title="Admin Queue 2",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Queue two.",
    )
    delay_mock = mocker.patch("core.tasks.process_content.delay")
    admin_instance = ContentAdmin(Content, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.generate_newsletter_ideas(
        request=_request(),
        queryset=Content.objects.filter(
            id__in=[_require_pk(first_content), _require_pk(second_content)]
        ).order_by("id"),
    )

    delay_mock.assert_any_call(_require_pk(first_content))
    delay_mock.assert_any_call(_require_pk(second_content))
    assert delay_mock.call_count == 2
    message_user_mock.assert_called_once_with(
        ANY,
        "Successfully queued the pipeline for 2 items.",
        messages.SUCCESS,
    )


def test_content_admin_duplicate_columns_render_expected_values(source_admin_context):
    canonical = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-canonical",
        canonical_url="https://example.com/admin-canonical",
        title="Canonical Story",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Canonical content.",
        duplicate_signal_count=2,
    )
    duplicate = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-canonical?utm_source=reddit",
        canonical_url="https://example.com/admin-canonical",
        title="Duplicate Story",
        author="Editor",
        source_plugin=SourcePluginName.REDDIT,
        published_date=timezone.now(),
        content_text="Duplicate content.",
        duplicate_of=canonical,
        is_active=False,
    )
    admin_instance = ContentAdmin(Content, AdminSite())

    assert "Also seen in 2 source(s)" in admin_instance.duplicate_badge(canonical)
    assert admin_instance.duplicate_badge(duplicate) == "-"
    assert admin_instance.duplicate_parent(canonical) == "-"
    assert admin_instance.duplicate_parent(duplicate) == "Canonical Story"


def test_high_value_filter_only_returns_high_value_reference_content(
    source_admin_context,
):
    high_value = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/high-value",
        title="High Value",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="High value content.",
        relevance_score=81,
        is_reference=True,
    )
    Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/not-high-value",
        title="Not High Value",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Not high value content.",
        relevance_score=81,
        is_reference=False,
    )
    filter_instance = HighValueFilter(
        request=_request(),
        params=_params(value_tier="high_value"),
        model=Content,
        model_admin=ContentAdmin(Content, AdminSite()),
    )
    filter_instance.value = lambda: "high_value"

    filtered = filter_instance.queryset(_request(), Content.objects.all())

    assert list(filtered) == [high_value]


def test_duplicate_state_filter_returns_canonical_rows_with_duplicate_signals(
    source_admin_context,
):
    canonical = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/filter-canonical",
        canonical_url="https://example.com/filter-canonical",
        title="Canonical",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Canonical content.",
        duplicate_signal_count=2,
    )
    Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/filter-plain",
        canonical_url="https://example.com/filter-plain",
        title="Plain",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Plain content.",
    )
    filter_instance = DuplicateStateFilter(
        request=_request(),
        params=_params(duplicate_state="canonical_with_duplicates"),
        model=Content,
        model_admin=ContentAdmin(Content, AdminSite()),
    )
    filter_instance.value = lambda: "canonical_with_duplicates"

    filtered = filter_instance.queryset(_request(), Content.objects.all())

    assert list(filtered) == [canonical]


def test_duplicate_state_filter_returns_suppressed_duplicates(
    source_admin_context,
):
    canonical = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/filter-parent",
        canonical_url="https://example.com/filter-parent",
        title="Canonical",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Canonical content.",
    )
    duplicate = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/filter-parent?utm_source=reddit",
        canonical_url="https://example.com/filter-parent",
        title="Duplicate",
        author="Editor",
        source_plugin=SourcePluginName.REDDIT,
        published_date=timezone.now(),
        content_text="Duplicate content.",
        duplicate_of=canonical,
        is_active=False,
    )
    filter_instance = DuplicateStateFilter(
        request=_request(),
        params=_params(duplicate_state="suppressed_duplicates"),
        model=Content,
        model_admin=ContentAdmin(Content, AdminSite()),
    )
    filter_instance.value = lambda: "suppressed_duplicates"

    filtered = filter_instance.queryset(_request(), Content.objects.all())

    assert list(filtered) == [duplicate]


def test_content_view_trace_builds_template_trace_url(source_admin_context, settings):
    settings.AI_TRACE_URL_TEMPLATE = "https://trace.example/{project_id}/{skill_name}/{skill_result_id}/{trace_id}/{content_id}/{run_id}"
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-template-trace",
        title="Admin Template Trace",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Template trace content.",
    )
    skill_result = SkillResult.objects.create(
        content=content,
        project=source_admin_context.project,
        skill_name="summarization",
        status="COMPLETED",
        result_data={"trace": {"trace_id": "trace-123"}},
    )
    admin_instance = ContentAdmin(Content, AdminSite())

    rendered = admin_instance.view_trace(content)

    assert (
        f"https://trace.example/{_require_pk(source_admin_context.project)}/summarization/{_require_pk(skill_result)}/trace-123/{_require_pk(content)}/trace-123"
        in rendered
    )


@pytest.mark.parametrize(
    ("score", "expected_color"),
    [
        (None, None),
        (80, "green"),
        (50, "orange"),
        (10, "red"),
    ],
)
def test_content_display_relevance_uses_expected_output(
    source_admin_context, score, expected_color
):
    content = Content.objects.create(
        project=source_admin_context.project,
        url=f"https://example.com/relevance-{score}",
        title="Relevance Display",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Content.",
        relevance_score=score,
    )
    admin_instance = ContentAdmin(Content, AdminSite())

    rendered = admin_instance.display_relevance(content)

    if score is None:
        assert rendered == "-"
    else:
        assert expected_color in rendered
        assert str(score) in rendered


def test_user_feedback_admin_helpers_and_dashboard_stats(
    source_admin_context, django_user_model, mocker
):
    mocker.patch("content.signals.queue_topic_centroid_recompute")
    user = _create_user(
        django_user_model, username="feedback-user", password="testpass123"
    )
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/feedback",
        title="Feedback Title That Is Long Enough To Truncate",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Feedback content.",
        relevance_score=85,
    )
    upvote = UserFeedback.objects.create(
        content=content,
        project=source_admin_context.project,
        user=user,
        feedback_type="upvote",
    )
    other_content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/feedback-other",
        title="Other Feedback Title",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Other feedback content.",
        relevance_score=20,
    )
    UserFeedback.objects.create(
        content=other_content,
        project=source_admin_context.project,
        user=_create_user(
            django_user_model, username="feedback-user-2", password="testpass123"
        ),
        feedback_type="downvote",
    )
    admin_instance = UserFeedbackAdmin(UserFeedback, AdminSite())
    super_changelist_view = mocker.patch(
        "content.admin.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )

    response = admin_instance.changelist_view(_request())
    dashboard_stats = _dashboard_stats(response)

    assert "👍" in admin_instance.display_feedback(upvote)
    assert admin_instance.get_content_title(upvote).endswith("...")
    assert "green" in admin_instance.get_ai_score(upvote)
    other_content.relevance_score = None
    other_content.save(update_fields=["relevance_score"])
    downvote = UserFeedback.objects.get(content=other_content)
    assert admin_instance.get_ai_score(downvote) == "-"
    super_changelist_view.assert_called_once()
    assert dashboard_stats[0]["value"] == "50.0%"
    assert dashboard_stats[1]["value"] == 2


def test_content_view_trace_returns_dash_when_no_skill_results(source_admin_context):
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/admin-no-trace",
        title="No Trace",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="No trace content.",
    )
    admin_instance = ContentAdmin(Content, AdminSite())

    assert admin_instance.view_trace(content) == "-"


def test_high_value_filter_lookups_and_noop_queryset(source_admin_context):
    filter_instance = HighValueFilter(
        request=_request(),
        params={},
        model=Content,
        model_admin=ContentAdmin(Content, AdminSite()),
    )
    filter_instance.value = lambda: None
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/high-value-noop",
        title="Noop",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="noop",
    )

    assert filter_instance.lookups(_request(), ContentAdmin(Content, AdminSite())) == (
        ("high_value", "🔥 High Value (Score > 80 & Reference)"),
    )
    assert list(filter_instance.queryset(_request(), Content.objects.all())) == [
        content
    ]


def test_user_feedback_admin_upvote_and_orange_score_branches(
    source_admin_context, mocker
):
    mocker.patch("content.signals.queue_topic_centroid_recompute")
    content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/feedback-orange",
        title="Orange Feedback Title",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Feedback content.",
        relevance_score=60,
    )
    feedback = UserFeedback.objects.create(
        content=content,
        project=source_admin_context.project,
        user=source_admin_context.user,
        feedback_type="upvote",
    )
    admin_instance = UserFeedbackAdmin(UserFeedback, AdminSite())

    assert "👍" in admin_instance.display_feedback(feedback)
    assert "orange" in admin_instance.get_ai_score(feedback)


def test_user_feedback_changelist_view_uses_success_color_for_high_approval(
    source_admin_context, django_user_model, mocker
):
    mocker.patch("content.signals.queue_topic_centroid_recompute")
    first_content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/feedback-success-1",
        title="Feedback Success One",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Feedback content one.",
        relevance_score=90,
    )
    second_content = Content.objects.create(
        project=source_admin_context.project,
        url="https://example.com/feedback-success-2",
        title="Feedback Success Two",
        author="Editor",
        source_plugin=SourcePluginName.RSS,
        published_date=timezone.now(),
        content_text="Feedback content two.",
        relevance_score=90,
    )
    UserFeedback.objects.create(
        content=first_content,
        project=source_admin_context.project,
        user=source_admin_context.user,
        feedback_type="upvote",
    )
    UserFeedback.objects.create(
        content=second_content,
        project=source_admin_context.project,
        user=_create_user(
            django_user_model, username="feedback-success-2", password="testpass123"
        ),
        feedback_type="upvote",
    )
    admin_instance = UserFeedbackAdmin(UserFeedback, AdminSite())
    super_changelist_view = mocker.patch(
        "content.admin.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )

    response = admin_instance.changelist_view(_request())
    dashboard_stats = _dashboard_stats(response)

    super_changelist_view.assert_called_once()
    assert dashboard_stats[0]["color"] == "success"
    assert dashboard_stats[0]["value"] == "100.0%"
