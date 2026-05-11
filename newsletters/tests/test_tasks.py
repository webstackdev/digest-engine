from datetime import timedelta
from typing import cast

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from content.models import Content
from newsletters.composition import (
    generate_newsletter_draft,
    regenerate_newsletter_draft_section,
)
from newsletters.models import (
    NewsletterDraft,
    NewsletterDraftItem,
    NewsletterDraftSection,
    NewsletterDraftStatus,
)
from newsletters.tasks import (
    generate_newsletter_draft as run_generate_newsletter_draft,
)
from newsletters.tasks import (
    regenerate_newsletter_draft_section as run_regenerate_newsletter_draft_section,
)
from newsletters.tasks import run_all_scheduled_newsletter_drafts
from notifications.models import Notification, NotificationLevel
from projects.models import Project, ProjectConfig, ProjectMembership, ProjectRole
from trends.models import (
    ContentClusterMembership,
    OriginalContentIdea,
    OriginalContentIdeaStatus,
    ThemeSuggestion,
    ThemeSuggestionStatus,
    TopicCluster,
)

pytestmark = pytest.mark.django_db


def _require_pk(instance):
    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _make_content(
    project: Project, *, title: str, days_ago: int, score: float
) -> Content:
    return Content.objects.create(
        project=project,
        url=f"https://example.com/{title.lower().replace(' ', '-')}",
        title=title,
        author="Reporter",
        source_plugin="rss",
        published_date=timezone.now() - timedelta(days=days_ago),
        content_text=f"{title} content body with useful reporting context.",
        relevance_score=score,
        authority_adjusted_score=score,
    )


def _make_project_admin(project: Project, *, username: str):
    user_model = get_user_model()
    user = user_model.objects.create_user(username=username, password="testpass123")
    ProjectMembership.objects.create(
        user=user,
        project=project,
        role=ProjectRole.ADMIN,
    )
    return user


def test_generate_newsletter_draft_builds_tree_and_renderings(settings):
    settings.OPENROUTER_API_KEY = ""
    project = Project.objects.create(
        name="Draft Project",
        topic_description="Platform engineering",
    )
    cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at=timezone.now() - timedelta(days=3),
        last_seen_at=timezone.now() - timedelta(days=1),
        is_active=True,
        member_count=2,
        label="Delivery pipelines",
    )
    theme_one = ThemeSuggestion.objects.create(
        project=project,
        cluster=cluster,
        title="Release automation",
        pitch="Release automation is changing how teams ship.",
        why_it_matters="Readers need to understand where orchestration is tightening.",
        suggested_angle="",
        velocity_at_creation=1.4,
        novelty_score=0.7,
        status=ThemeSuggestionStatus.ACCEPTED,
        decided_at=timezone.now() - timedelta(days=1),
    )
    theme_two = ThemeSuggestion.objects.create(
        project=project,
        cluster=cluster,
        title="CI observability",
        pitch="Teams are investing in better CI visibility.",
        why_it_matters="It changes where platform teams spend debugging time.",
        suggested_angle="",
        velocity_at_creation=1.2,
        novelty_score=0.65,
        status=ThemeSuggestionStatus.ACCEPTED,
        decided_at=timezone.now() - timedelta(hours=12),
    )
    content_one = _make_content(
        project, title="Automation story", days_ago=1, score=0.9
    )
    content_two = _make_content(
        project, title="Observability story", days_ago=2, score=0.85
    )
    content_three = _make_content(
        project, title="Debugging story", days_ago=3, score=0.8
    )
    content_one.newsletter_promotion_theme = theme_one
    content_one.save(update_fields=["newsletter_promotion_theme"])
    content_two.newsletter_promotion_theme = theme_two
    content_two.save(update_fields=["newsletter_promotion_theme"])
    ContentClusterMembership.objects.create(
        content=content_three,
        cluster=cluster,
        project=project,
        similarity=0.91,
    )
    idea = OriginalContentIdea.objects.create(
        project=project,
        related_cluster=cluster,
        angle_title="What platform teams still miss",
        summary="A forward-looking take on the operational blind spots left after tool adoption.",
        suggested_outline="1. Adoption\n2. Blind spots\n3. Recommendations",
        why_now="The surrounding coverage makes this timing strong.",
        generated_by_model="heuristic",
        self_critique_score=0.83,
        status=OriginalContentIdeaStatus.ACCEPTED,
        decided_at=timezone.now() - timedelta(hours=6),
    )
    idea.supporting_contents.add(content_one, content_two)

    result = generate_newsletter_draft(
        _require_pk(project),
        trigger_source="scheduled",
    )

    draft_id = cast(int | None, result["draft_id"])
    assert draft_id is not None
    draft = NewsletterDraft.objects.get(pk=draft_id)
    first_section = draft.sections.first()
    first_original_piece = draft.original_pieces.first()

    assert result["status"] == NewsletterDraftStatus.READY
    assert draft.sections.count() == 2
    assert draft.original_pieces.count() == 1
    assert first_section is not None
    assert first_original_piece is not None
    assert first_section.theme_suggestion in {theme_one, theme_two}
    assert first_section.items.count() >= 1
    assert first_original_piece.idea == idea
    assert "# " in draft.render_markdown()
    assert "<h1>" in draft.render_html()
    assert draft.generation_metadata["trigger_source"] == "scheduled"
    assert draft.generation_metadata["source_theme_ids"] == [
        _require_pk(theme_two),
        _require_pk(theme_one),
    ] or draft.generation_metadata["source_theme_ids"] == [
        _require_pk(theme_one),
        _require_pk(theme_two),
    ]


def test_generate_newsletter_draft_skips_without_enough_inputs(settings):
    settings.OPENROUTER_API_KEY = ""
    project = Project.objects.create(
        name="Sparse Project",
        topic_description="Developer workflows",
    )
    ThemeSuggestion.objects.create(
        project=project,
        title="Only one theme",
        pitch="Pitch",
        why_it_matters="Why",
        suggested_angle="",
        velocity_at_creation=1.0,
        novelty_score=0.5,
        status=ThemeSuggestionStatus.ACCEPTED,
        decided_at=timezone.now(),
    )

    result = generate_newsletter_draft(_require_pk(project))

    assert result == {
        "project_id": _require_pk(project),
        "draft_id": None,
        "status": "skipped",
        "reason": "insufficient_inputs",
        "sections_created": 0,
        "original_pieces_created": 0,
    }
    assert NewsletterDraft.objects.count() == 0


def test_regenerate_newsletter_draft_section_replaces_items_and_marks_draft_edited(
    settings,
):
    settings.OPENROUTER_API_KEY = ""
    project = Project.objects.create(
        name="Edit Project",
        topic_description="Reliability engineering",
    )
    cluster = TopicCluster.objects.create(
        project=project,
        first_seen_at=timezone.now() - timedelta(days=2),
        last_seen_at=timezone.now() - timedelta(days=1),
        is_active=True,
        member_count=1,
        label="Reliability",
    )
    theme = ThemeSuggestion.objects.create(
        project=project,
        cluster=cluster,
        title="Incident review",
        pitch="Pitch",
        why_it_matters="Why",
        suggested_angle="",
        velocity_at_creation=1.0,
        novelty_score=0.7,
        status=ThemeSuggestionStatus.ACCEPTED,
        decided_at=timezone.now(),
    )
    content = _make_content(project, title="Incident story", days_ago=1, score=0.9)
    content.newsletter_promotion_theme = theme
    content.save(update_fields=["newsletter_promotion_theme"])
    draft = NewsletterDraft.objects.create(
        project=project,
        title="Draft",
        intro="Intro",
        outro="Outro",
        status=NewsletterDraftStatus.READY,
        generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
    )
    section = NewsletterDraftSection.objects.create(
        draft=draft,
        theme_suggestion=theme,
        title="Old title",
        lede="Old lede",
        order=0,
    )
    old_item = NewsletterDraftItem.objects.create(
        section=section,
        content=content,
        summary_used="Old summary",
        why_it_matters="Old why",
        order=0,
    )

    result = regenerate_newsletter_draft_section(_require_pk(section))

    draft.refresh_from_db()
    section.refresh_from_db()
    replacement_item = section.items.first()

    assert result["status"] == "completed"
    assert draft.status == NewsletterDraftStatus.EDITED
    assert draft.last_edited_at is not None
    assert not NewsletterDraftItem.objects.filter(pk=_require_pk(old_item)).exists()
    assert section.items.count() == 1
    assert replacement_item is not None
    assert replacement_item.summary_used != "Old summary"


def test_task_generate_newsletter_draft_notifies_project_admins_on_success(
    settings, mocker
):
    settings.MESSAGING_ENABLED = True
    project = Project.objects.create(
        name="Task Project",
        topic_description="Platform engineering",
    )
    _make_project_admin(project, username="admin-one")
    _make_project_admin(project, username="admin-two")
    compose_mock = mocker.patch(
        "newsletters.tasks.compose_newsletter_draft",
        return_value={
            "project_id": _require_pk(project),
            "draft_id": 42,
            "status": NewsletterDraftStatus.READY,
            "sections_created": 2,
            "original_pieces_created": 1,
        },
    )

    result = run_generate_newsletter_draft(
        _require_pk(project), trigger_source="manual"
    )

    compose_mock.assert_called_once_with(_require_pk(project), trigger_source="manual")
    assert result["draft_id"] == 42
    notifications = list(Notification.objects.order_by("user__username"))
    assert len(notifications) == 2
    assert all(
        notification.level == NotificationLevel.SUCCESS
        for notification in notifications
    )
    assert {notification.link_path for notification in notifications} == {"/drafts/42"}
    assert notifications[0].metadata["draft_id"] == 42


def test_task_generate_newsletter_draft_notifies_project_admins_on_failure(
    settings, mocker
):
    settings.MESSAGING_ENABLED = True
    project = Project.objects.create(
        name="Task Failure Project",
        topic_description="Platform engineering",
    )
    _make_project_admin(project, username="admin-one")
    mocker.patch(
        "newsletters.tasks.compose_newsletter_draft",
        side_effect=RuntimeError("LLM provider unavailable"),
    )

    with pytest.raises(RuntimeError, match="LLM provider unavailable"):
        run_generate_newsletter_draft(_require_pk(project), trigger_source="scheduled")

    notification = Notification.objects.get()
    assert notification.level == NotificationLevel.ERROR
    assert notification.body == "Newsletter draft generation failed."
    assert notification.link_path == "/drafts"
    assert notification.metadata["project_id"] == _require_pk(project)
    assert notification.metadata["trigger_source"] == "scheduled"
    assert notification.metadata["error"] == "LLM provider unavailable"


def test_task_regenerate_newsletter_draft_section_notifies_project_admins_on_success(
    settings, mocker
):
    settings.MESSAGING_ENABLED = True
    project = Project.objects.create(
        name="Section Task Project",
        topic_description="Platform engineering",
    )
    _make_project_admin(project, username="admin-one")
    draft = NewsletterDraft.objects.create(
        project=project,
        title="Draft",
        intro="Intro",
        outro="Outro",
        status=NewsletterDraftStatus.READY,
        generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
    )
    section = NewsletterDraftSection.objects.create(
        draft=draft,
        title="Old title",
        lede="Old lede",
        order=0,
    )
    compose_mock = mocker.patch(
        "newsletters.tasks.compose_newsletter_draft_section",
        return_value={
            "project_id": _require_pk(project),
            "draft_id": _require_pk(draft),
            "section_id": _require_pk(section),
            "status": "completed",
        },
    )

    result = run_regenerate_newsletter_draft_section(_require_pk(section))

    compose_mock.assert_called_once_with(_require_pk(section))
    assert result["status"] == "completed"
    notification = Notification.objects.get()
    assert notification.level == NotificationLevel.SUCCESS
    assert notification.body == "Newsletter draft section refreshed."
    assert notification.link_path == f"/drafts/{_require_pk(draft)}"
    assert notification.metadata["section_id"] == _require_pk(section)


def test_task_regenerate_newsletter_draft_section_notifies_project_admins_on_failure(
    settings, mocker
):
    settings.MESSAGING_ENABLED = True
    project = Project.objects.create(
        name="Section Failure Project",
        topic_description="Platform engineering",
    )
    _make_project_admin(project, username="admin-one")
    draft = NewsletterDraft.objects.create(
        project=project,
        title="Draft",
        intro="Intro",
        outro="Outro",
        status=NewsletterDraftStatus.READY,
        generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
    )
    section = NewsletterDraftSection.objects.create(
        draft=draft,
        title="Old title",
        lede="Old lede",
        order=0,
    )
    mocker.patch(
        "newsletters.tasks.compose_newsletter_draft_section",
        side_effect=RuntimeError("section composition failed"),
    )

    with pytest.raises(RuntimeError, match="section composition failed"):
        run_regenerate_newsletter_draft_section(_require_pk(section))

    notification = Notification.objects.get()
    assert notification.level == NotificationLevel.ERROR
    assert notification.body == "Newsletter draft section regeneration failed."
    assert notification.link_path == f"/drafts/{_require_pk(draft)}"
    assert notification.metadata["section_id"] == _require_pk(section)
    assert notification.metadata["error"] == "section composition failed"


def test_run_all_scheduled_newsletter_drafts_executes_due_projects_inline(
    settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    fixed_now = timezone.now().replace(second=0, microsecond=0)
    due_expression = f"{fixed_now.minute} {fixed_now.hour} * * *"
    due_project = Project.objects.create(
        name="Due Project",
        topic_description="Platform engineering",
    )
    not_due_project = Project.objects.create(
        name="Not Due Project",
        topic_description="Frontend",
    )
    ProjectConfig.objects.create(
        project=due_project,
        draft_schedule_cron=due_expression,
    )
    ProjectConfig.objects.create(
        project=not_due_project,
        draft_schedule_cron="0 0 * * *",
    )
    generate_mock = mocker.patch("newsletters.tasks.generate_newsletter_draft")
    mocker.patch("newsletters.tasks.timezone.now", return_value=fixed_now)

    result = run_all_scheduled_newsletter_drafts()

    assert result == {
        "checked": 2,
        "queued": 1,
        "skipped_not_due": 1,
        "skipped_daily_cap": 0,
    }
    generate_mock.assert_called_once_with(
        _require_pk(due_project),
        trigger_source="scheduled",
    )


def test_run_all_scheduled_newsletter_drafts_enqueues_due_projects_when_not_eager(
    settings, mocker
):
    settings.CELERY_TASK_ALWAYS_EAGER = False
    fixed_now = timezone.now().replace(second=0, microsecond=0)
    due_expression = f"{fixed_now.minute} {fixed_now.hour} * * *"
    due_project = Project.objects.create(
        name="Queued Project",
        topic_description="Infra",
    )
    ProjectConfig.objects.create(
        project=due_project,
        draft_schedule_cron=due_expression,
    )
    delay_mock = mocker.patch("newsletters.tasks.generate_newsletter_draft.delay")
    mocker.patch("newsletters.tasks.timezone.now", return_value=fixed_now)

    result = run_all_scheduled_newsletter_drafts()

    assert result == {
        "checked": 1,
        "queued": 1,
        "skipped_not_due": 0,
        "skipped_daily_cap": 0,
    }
    delay_mock.assert_called_once_with(
        _require_pk(due_project),
        trigger_source="scheduled",
    )


def test_run_all_scheduled_newsletter_drafts_skips_daily_cap(settings, mocker):
    settings.CELERY_TASK_ALWAYS_EAGER = False
    fixed_now = timezone.now().replace(second=0, microsecond=0)
    due_expression = f"{fixed_now.minute} {fixed_now.hour} * * *"
    capped_project = Project.objects.create(
        name="Capped Project",
        topic_description="Signals",
    )
    ProjectConfig.objects.create(
        project=capped_project,
        draft_schedule_cron=due_expression,
    )
    NewsletterDraft.objects.create(
        project=capped_project,
        title="Already scheduled today",
        intro="Intro",
        outro="Outro",
        status=NewsletterDraftStatus.READY,
        generation_metadata={
            "source_theme_ids": [],
            "source_idea_ids": [],
            "trigger_source": "scheduled",
        },
    )
    delay_mock = mocker.patch("newsletters.tasks.generate_newsletter_draft.delay")
    mocker.patch("newsletters.tasks.timezone.now", return_value=fixed_now)

    result = run_all_scheduled_newsletter_drafts()

    assert result == {
        "checked": 1,
        "queued": 0,
        "skipped_not_due": 0,
        "skipped_daily_cap": 1,
    }
    delay_mock.assert_not_called()
