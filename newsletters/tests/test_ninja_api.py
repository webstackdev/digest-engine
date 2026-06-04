from __future__ import annotations

from http import HTTPStatus
from typing import Any, cast
from unittest.mock import AsyncMock, patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.test import TestCase
from django.urls import reverse

from newsletters.models import (
    IntakeAllowlist,
    NewsletterDraft,
    NewsletterDraftItem,
    NewsletterDraftOriginalPiece,
    NewsletterDraftSection,
    NewsletterDraftStatus,
    NewsletterIntake,
    NewsletterIntakeStatus,
)
from projects.models import Project, ProjectMembership, ProjectRole
from trends.models import (
    OriginalContentIdea,
    OriginalContentIdeaStatus,
    ThemeSuggestion,
    ThemeSuggestionStatus,
)


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed API test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _create_user(user_model: type[Any], **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


class NewsletterNinjaApiTests(TestCase):
    """Exercise newsletter-owned Ninja API endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.reader = _create_user(
            user_model, username="reader", password="testpass123"
        )
        self.other_user = _create_user(
            user_model,
            username="other",
            password="testpass123",
        )
        self.owner_project = Project.objects.create(
            name="Owner Project",
            topic_description="Platform engineering",
        )
        self.other_project = Project.objects.create(
            name="Other Project",
            topic_description="Frontend",
        )
        ProjectMembership.objects.create(
            user=self.owner,
            project=self.owner_project,
            role=ProjectRole.ADMIN,
        )
        ProjectMembership.objects.create(
            user=self.reader,
            project=self.owner_project,
            role=ProjectRole.READER,
        )
        ProjectMembership.objects.create(
            user=self.other_user,
            project=self.other_project,
            role=ProjectRole.ADMIN,
        )
        self.owner_intake_allowlist = IntakeAllowlist.objects.create(
            project=self.owner_project,
            sender_email="sender@example.com",
        )
        self.owner_intake = NewsletterIntake.objects.create(
            project=self.owner_project,
            sender_email="sender@example.com",
            subject="Owner Digest",
            raw_text="See https://example.com/post",
            message_id="owner-intake-1",
            status=NewsletterIntakeStatus.EXTRACTED,
            extraction_result={"items": []},
        )
        self.client.force_login(self.owner)

    def test_intake_allowlist_list_is_scoped_to_request_user_project(self):
        other_allowlist = IntakeAllowlist.objects.create(
            project=self.other_project,
            sender_email="other@example.com",
        )

        response = self.client.get(
            reverse(
                "ninja-api:list_intake_allowlist",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(
            response.json()[0]["id"], _require_pk(self.owner_intake_allowlist)
        )
        self.assertFalse(response.json()[0]["is_confirmed"])
        self.assertNotEqual(response.json()[0]["id"], _require_pk(other_allowlist))

    def test_intake_allowlist_create_and_delete_manage_project_senders(self):
        create_response = self.client.post(
            reverse(
                "ninja-api:create_intake_allowlist",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"sender_email": "new-sender@example.com"},
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, HTTPStatus.CREATED)
        created_allowlist = IntakeAllowlist.objects.get(
            project=self.owner_project,
            sender_email="new-sender@example.com",
        )
        self.assertEqual(
            create_response.json()["project"], _require_pk(self.owner_project)
        )

        delete_response = self.client.delete(
            reverse(
                "ninja-api:delete_intake_allowlist",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "allowlist_id": _require_pk(created_allowlist),
                },
            )
        )

        self.assertEqual(delete_response.status_code, HTTPStatus.NO_CONTENT)
        self.assertFalse(
            IntakeAllowlist.objects.filter(pk=_require_pk(created_allowlist)).exists()
        )

    def test_newsletter_intake_list_is_scoped_to_request_project(self):
        NewsletterIntake.objects.create(
            project=self.other_project,
            sender_email="other@example.com",
            subject="Other Digest",
            raw_text="Other raw text",
            message_id="other-intake-1",
            status=NewsletterIntakeStatus.PENDING,
        )

        response = self.client.get(
            reverse(
                "ninja-api:list_newsletter_intakes",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(self.owner_intake))

    def test_newsletter_draft_list_is_scoped_to_request_project(self):
        owner_draft = NewsletterDraft.objects.create(
            project=self.owner_project,
            title="Owner draft",
            intro="Owner intro",
            outro="Owner outro",
            status=NewsletterDraftStatus.READY,
            generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
        )
        NewsletterDraft.objects.create(
            project=self.other_project,
            title="Other draft",
            intro="Other intro",
            outro="Other outro",
            status=NewsletterDraftStatus.READY,
            generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
        )

        response = self.client.get(
            reverse(
                "ninja-api:list_newsletter_drafts",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(owner_draft))
        self.assertIn("rendered_markdown", response.json()[0])
        self.assertIn("rendered_html", response.json()[0])

    def test_newsletter_draft_generate_action_runs_immediately_in_eager_mode(self):
        with self.settings(TASKIQ_ALWAYS_EAGER=True):
            with patch(
                "newsletters.ninja_api.generate_newsletter_draft",
                return_value={
                    "project_id": _require_pk(self.owner_project),
                    "draft_id": 42,
                    "status": "ready",
                    "sections_created": 2,
                    "original_pieces_created": 1,
                },
            ) as generate_mock:
                response = self.client.post(
                    reverse(
                        "ninja-api:generate_newsletter_draft_route",
                        kwargs={"project_id": _require_pk(self.owner_project)},
                    ),
                )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json()["status"], "completed")
        self.assertEqual(response.json()["result"]["draft_id"], 42)
        generate_mock.assert_called_once_with(_require_pk(self.owner_project))

    def test_newsletter_draft_generate_action_queues_in_background_mode(self):
        with self.settings(TASKIQ_ALWAYS_EAGER=False):
            with patch(
                "newsletters.ninja_api.generate_newsletter_draft.kiq",
                new_callable=AsyncMock,
            ) as queue_mock:
                response = self.client.post(
                    reverse(
                        "ninja-api:generate_newsletter_draft_route",
                        kwargs={"project_id": _require_pk(self.owner_project)},
                    ),
                )

        self.assertEqual(response.status_code, HTTPStatus.ACCEPTED)
        self.assertEqual(response.json()["status"], "queued")
        queue_mock.assert_awaited_once_with(_require_pk(self.owner_project))

    def test_newsletter_draft_regenerate_section_runs_immediately_in_eager_mode(self):
        draft = NewsletterDraft.objects.create(
            project=self.owner_project,
            title="Draft",
            intro="Intro",
            outro="Outro",
            status=NewsletterDraftStatus.READY,
            generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
        )
        theme = ThemeSuggestion.objects.create(
            project=self.owner_project,
            title="Theme",
            pitch="Pitch",
            why_it_matters="Why",
            suggested_angle="",
            velocity_at_creation=1.0,
            novelty_score=0.7,
            status=ThemeSuggestionStatus.ACCEPTED,
        )
        section = NewsletterDraftSection.objects.create(
            draft=draft,
            theme_suggestion=theme,
            title="Before",
            lede="Before lede",
            order=0,
        )

        with self.settings(TASKIQ_ALWAYS_EAGER=True):
            with patch(
                "newsletters.ninja_api.regenerate_newsletter_draft_section",
                return_value={
                    "project_id": _require_pk(self.owner_project),
                    "draft_id": _require_pk(draft),
                    "section_id": _require_pk(section),
                    "status": "completed",
                },
            ) as regenerate_mock:
                response = self.client.post(
                    reverse(
                        "ninja-api:regenerate_newsletter_draft_section_route",
                        kwargs={
                            "project_id": _require_pk(self.owner_project),
                            "draft_id": _require_pk(draft),
                        },
                    ),
                    {"section_id": _require_pk(section)},
                    content_type="application/json",
                )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        regenerate_mock.assert_called_once_with(_require_pk(section))
        self.assertEqual(response.json()["id"], _require_pk(draft))

    def test_newsletter_draft_regenerate_section_queues_in_background_mode(self):
        draft = NewsletterDraft.objects.create(
            project=self.owner_project,
            title="Draft",
            intro="Intro",
            outro="Outro",
            status=NewsletterDraftStatus.READY,
            generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
        )
        theme = ThemeSuggestion.objects.create(
            project=self.owner_project,
            title="Theme",
            pitch="Pitch",
            why_it_matters="Why",
            suggested_angle="",
            velocity_at_creation=1.0,
            novelty_score=0.7,
            status=ThemeSuggestionStatus.ACCEPTED,
        )
        section = NewsletterDraftSection.objects.create(
            draft=draft,
            theme_suggestion=theme,
            title="Before",
            lede="Before lede",
            order=0,
        )

        with self.settings(TASKIQ_ALWAYS_EAGER=False):
            with patch(
                "newsletters.ninja_api.regenerate_newsletter_draft_section.kiq",
                new_callable=AsyncMock,
            ) as queue_mock:
                response = self.client.post(
                    reverse(
                        "ninja-api:regenerate_newsletter_draft_section_route",
                        kwargs={
                            "project_id": _require_pk(self.owner_project),
                            "draft_id": _require_pk(draft),
                        },
                    ),
                    {"section_id": _require_pk(section)},
                    content_type="application/json",
                )

        self.assertEqual(response.status_code, HTTPStatus.ACCEPTED)
        self.assertEqual(response.json()["status"], "queued")
        self.assertEqual(response.json()["draft_id"], _require_pk(draft))
        self.assertEqual(response.json()["section_id"], _require_pk(section))
        queue_mock.assert_awaited_once_with(_require_pk(section))

    def test_newsletter_draft_regenerate_section_rejects_section_from_other_draft(self):
        draft = NewsletterDraft.objects.create(
            project=self.owner_project,
            title="Draft",
            intro="Intro",
            outro="Outro",
            status=NewsletterDraftStatus.READY,
            generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
        )
        other_draft = NewsletterDraft.objects.create(
            project=self.owner_project,
            title="Other draft",
            intro="Intro",
            outro="Outro",
            status=NewsletterDraftStatus.READY,
            generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
        )
        theme = ThemeSuggestion.objects.create(
            project=self.owner_project,
            title="Theme",
            pitch="Pitch",
            why_it_matters="Why",
            suggested_angle="",
            velocity_at_creation=1.0,
            novelty_score=0.7,
            status=ThemeSuggestionStatus.ACCEPTED,
        )
        other_section = NewsletterDraftSection.objects.create(
            draft=other_draft,
            theme_suggestion=theme,
            title="Other section",
            lede="Other lede",
            order=0,
        )

        response = self.client.post(
            reverse(
                "ninja-api:regenerate_newsletter_draft_section_route",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "draft_id": _require_pk(draft),
                },
            ),
            {"section_id": _require_pk(other_section)},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(
            response.json()["section_id"][0],
            "Draft section not found for this project.",
        )

    def test_newsletter_draft_item_patch_marks_draft_as_edited(self):
        draft = NewsletterDraft.objects.create(
            project=self.owner_project,
            title="Draft",
            intro="Intro",
            outro="Outro",
            status=NewsletterDraftStatus.READY,
            generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
        )
        theme = ThemeSuggestion.objects.create(
            project=self.owner_project,
            title="Theme",
            pitch="Pitch",
            why_it_matters="Why",
            suggested_angle="",
            velocity_at_creation=1.0,
            novelty_score=0.7,
            status=ThemeSuggestionStatus.ACCEPTED,
        )
        section = NewsletterDraftSection.objects.create(
            draft=draft,
            theme_suggestion=theme,
            title="Section",
            lede="Lede",
            order=0,
        )
        content = self.owner_project.contents.create(
            url="https://example.com/item",
            title="Draft item",
            author="Reporter",
            source_plugin="rss",
            published_date="2026-05-01T00:00:00Z",
            content_text="Original summary",
        )
        item = NewsletterDraftItem.objects.create(
            section=section,
            content=content,
            summary_used="Original summary",
            why_it_matters="Original why",
            order=0,
        )

        response = self.client.patch(
            reverse(
                "ninja-api:update_newsletter_draft_item",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "item_id": _require_pk(item),
                },
            ),
            {"summary_used": "Updated summary"},
            content_type="application/json",
        )

        draft.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(item.summary_used, "Updated summary")
        self.assertEqual(draft.status, NewsletterDraftStatus.EDITED)
        self.assertIsNotNone(draft.last_edited_at)

    def test_newsletter_draft_original_piece_delete_marks_draft_as_edited(self):
        draft = NewsletterDraft.objects.create(
            project=self.owner_project,
            title="Draft",
            intro="Intro",
            outro="Outro",
            status=NewsletterDraftStatus.READY,
            generation_metadata={"source_theme_ids": [], "source_idea_ids": []},
        )
        idea = OriginalContentIdea.objects.create(
            project=self.owner_project,
            angle_title="Idea",
            summary="Summary",
            suggested_outline="Outline",
            why_now="Why now",
            generated_by_model="heuristic",
            self_critique_score=0.8,
            status=OriginalContentIdeaStatus.ACCEPTED,
        )
        original_piece = NewsletterDraftOriginalPiece.objects.create(
            draft=draft,
            idea=idea,
            title="Original piece",
            pitch="Pitch",
            suggested_outline="Outline",
            order=0,
        )

        response = self.client.delete(
            reverse(
                "ninja-api:delete_newsletter_draft_original_piece",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "original_piece_id": _require_pk(original_piece),
                },
            )
        )

        draft.refresh_from_db()
        self.assertEqual(response.status_code, HTTPStatus.NO_CONTENT)
        self.assertEqual(draft.status, NewsletterDraftStatus.EDITED)
        self.assertFalse(
            NewsletterDraftOriginalPiece.objects.filter(
                pk=_require_pk(original_piece)
            ).exists()
        )
