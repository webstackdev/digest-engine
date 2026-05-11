"""Newsletter draft composition helpers for the WP4 editor workflow."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import timedelta
from functools import lru_cache
from pathlib import Path
from typing import cast

from django.conf import settings
from django.db import transaction
from django.db.models import Model, Prefetch
from django.db.models.functions import Coalesce
from django.utils import timezone

from content.models import Content
from core.llm import openrouter_chat_json
from newsletters.models import (
    NewsletterDraft,
    NewsletterDraftItem,
    NewsletterDraftOriginalPiece,
    NewsletterDraftSection,
    NewsletterDraftStatus,
)
from pipeline.resilience import execute_with_resilience
from projects.models import Project
from trends.models import (
    OriginalContentIdea,
    OriginalContentIdeaStatus,
    ThemeSuggestion,
    ThemeSuggestionStatus,
)

NEWSLETTER_COMPOSITION_SKILL_NAME = "newsletter_composition"
THEME_LOOKBACK_DAYS = 14
MAX_SECTION_ITEMS = 4
MAX_STYLE_EXAMPLES = 3


def _metadata_dict(value: object) -> dict[str, object]:
    """Return a dictionary view of draft generation metadata."""

    if isinstance(value, dict):
        return cast(dict[str, object], value)
    return {}


def generate_newsletter_draft(
    project_id: int,
    *,
    trigger_source: str = "manual",
) -> dict[str, object]:
    """Compose one newsletter draft from recent accepted themes and ideas."""

    project = Project.objects.get(pk=project_id)
    themes = _accepted_themes(project_id)
    ideas = _accepted_ideas(project_id)
    if len(themes) < 2 or not ideas:
        return {
            "project_id": project_id,
            "draft_id": None,
            "status": "skipped",
            "reason": "insufficient_inputs",
            "sections_created": 0,
            "original_pieces_created": 0,
        }

    draft = NewsletterDraft.objects.create(
        project=project,
        title=_fallback_draft_title(project, themes),
        intro="",
        outro="",
        status=NewsletterDraftStatus.GENERATING,
        generation_metadata={
            "source_theme_ids": [_require_pk(theme) for theme in themes],
            "source_idea_ids": [_require_pk(idea) for idea in ideas],
            "trigger_source": trigger_source,
            "models": {},
        },
    )

    try:
        style_examples = _style_examples(project_id)
        section_payloads: list[dict[str, object]] = []
        used_content_ids: set[int] = set()
        with transaction.atomic():
            for index, theme in enumerate(themes):
                supporting_contents = _supporting_contents_for_theme(
                    theme,
                    used_content_ids=used_content_ids,
                )
                section_payload = _compose_section(theme, supporting_contents)
                section_payloads.append(section_payload)
                section = NewsletterDraftSection.objects.create(
                    draft=draft,
                    theme_suggestion=theme,
                    title=str(section_payload["section_title"]),
                    lede=str(section_payload["lede"]),
                    order=index,
                )
                for item_index, item_payload in enumerate(
                    cast(list[dict[str, object]], section_payload["items"])
                ):
                    content = cast(Content, item_payload["content"])
                    content_id = _require_pk(content)
                    used_content_ids.add(content_id)
                    NewsletterDraftItem.objects.create(
                        section=section,
                        content=content,
                        summary_used=str(item_payload["summary"]),
                        why_it_matters=str(item_payload["why_it_matters"]),
                        order=item_index,
                    )
            original_piece_payloads = _compose_original_pieces(ideas)
            for index, original_piece_payload in enumerate(original_piece_payloads):
                NewsletterDraftOriginalPiece.objects.create(
                    draft=draft,
                    idea=cast(OriginalContentIdea, original_piece_payload["idea"]),
                    title=str(original_piece_payload["title"]),
                    pitch=str(original_piece_payload["pitch"]),
                    suggested_outline=str(original_piece_payload["suggested_outline"]),
                    order=index,
                )
            framing_payload = _compose_intro_outro(
                project=project,
                section_payloads=section_payloads,
                original_piece_payloads=original_piece_payloads,
                style_examples=style_examples,
            )
            draft.title = str(framing_payload["title"])
            draft.intro = str(framing_payload["intro"])
            draft.outro = str(framing_payload["outro"])
            draft_generation_metadata = _metadata_dict(draft.generation_metadata)
            existing_models = _metadata_dict(draft_generation_metadata.get("models"))
            draft.generation_metadata = {
                **draft_generation_metadata,
                "models": {
                    **existing_models,
                    "section_composer": (
                        section_payloads[0].get(
                            "generated_by_model", "heuristic-newsletter-composition"
                        )
                        if section_payloads
                        else "heuristic-newsletter-composition"
                    ),
                    "intro_outro_composer": framing_payload.get(
                        "generated_by_model", "heuristic-newsletter-composition"
                    ),
                },
                "coherence_suggestions": _coherence_suggestions(
                    draft,
                    style_examples=style_examples,
                ),
            }
            draft.status = NewsletterDraftStatus.READY
            draft.save(
                update_fields=[
                    "title",
                    "intro",
                    "outro",
                    "generation_metadata",
                    "status",
                ]
            )
    except Exception as exc:
        draft.status = NewsletterDraftStatus.DISCARDED
        draft.generation_metadata = {
            **cast(dict[str, object], draft.generation_metadata),
            "error": str(exc),
        }
        draft.save(update_fields=["status", "generation_metadata"])
        raise

    return {
        "project_id": project_id,
        "draft_id": _require_pk(draft),
        "status": draft.status,
        "sections_created": draft.sections.count(),
        "original_pieces_created": draft.original_pieces.count(),
    }


def regenerate_newsletter_draft_section(section_id: int) -> dict[str, object]:
    """Re-run composition for one draft section without rebuilding the whole tree."""

    section = NewsletterDraftSection.objects.select_related(
        "draft",
        "theme_suggestion",
    ).get(pk=section_id)
    theme = section.theme_suggestion
    if theme is None:
        raise ValueError(
            "This draft section is no longer linked to a theme suggestion."
        )
    supporting_contents = _supporting_contents_for_theme(theme, used_content_ids=set())
    section_payload = _compose_section(theme, supporting_contents)
    with transaction.atomic():
        section.title = str(section_payload["section_title"])
        section.lede = str(section_payload["lede"])
        section.save(update_fields=["title", "lede"])
        section.items.all().delete()
        for item_index, item_payload in enumerate(
            cast(list[dict[str, object]], section_payload["items"])
        ):
            NewsletterDraftItem.objects.create(
                section=section,
                content=cast(Content, item_payload["content"]),
                summary_used=str(item_payload["summary"]),
                why_it_matters=str(item_payload["why_it_matters"]),
                order=item_index,
            )
        section.draft.status = NewsletterDraftStatus.EDITED
        metadata = cast(dict[str, object], section.draft.generation_metadata)
        metadata["last_regenerated_section_id"] = _require_pk(section)
        metadata["last_regenerated_at"] = timezone.now().isoformat()
        section.draft.generation_metadata = metadata
        section.draft.last_edited_at = timezone.now()
        section.draft.save(
            update_fields=["status", "generation_metadata", "last_edited_at"]
        )
    return {
        "project_id": _require_pk(section.draft.project),
        "draft_id": _require_pk(section.draft),
        "section_id": _require_pk(section),
        "status": "completed",
    }


def _accepted_themes(project_id: int) -> list[ThemeSuggestion]:
    """Return recent accepted themes that are not already in published drafts."""

    window_start = timezone.now() - timedelta(days=THEME_LOOKBACK_DAYS)
    return list(
        ThemeSuggestion.objects.filter(
            project_id=project_id,
            status=ThemeSuggestionStatus.ACCEPTED,
            decided_at__gte=window_start,
        )
        .exclude(draft_sections__draft__status=NewsletterDraftStatus.PUBLISHED)
        .select_related("cluster")
        .order_by("-decided_at", "-created_at")
    )


def _accepted_ideas(project_id: int) -> list[OriginalContentIdea]:
    """Return recent accepted original-content ideas for draft composition."""

    window_start = timezone.now() - timedelta(days=THEME_LOOKBACK_DAYS)
    return list(
        OriginalContentIdea.objects.filter(
            project_id=project_id,
            status=OriginalContentIdeaStatus.ACCEPTED,
            decided_at__gte=window_start,
        )
        .select_related("related_cluster")
        .prefetch_related(
            Prefetch(
                "supporting_contents",
                queryset=Content.objects.order_by("-published_date", "-id"),
            )
        )
        .order_by("-decided_at", "-created_at")
    )


def _style_examples(project_id: int) -> list[str]:
    """Return recent published draft renderings for tone grounding."""

    return [
        draft.render_markdown()
        for draft in NewsletterDraft.objects.filter(
            project_id=project_id,
            status=NewsletterDraftStatus.PUBLISHED,
        ).prefetch_related(
            Prefetch(
                "sections",
                queryset=NewsletterDraftSection.objects.prefetch_related(
                    Prefetch(
                        "items",
                        queryset=NewsletterDraftItem.objects.select_related("content"),
                    )
                ),
            ),
            "original_pieces",
        )[
            :MAX_STYLE_EXAMPLES
        ]
    ]


def _supporting_contents_for_theme(
    theme: ThemeSuggestion,
    *,
    used_content_ids: set[int],
) -> list[Content]:
    """Return the top ranked real content rows for one accepted theme."""

    candidate_queryset = theme.promoted_contents.filter(is_active=True)
    if not candidate_queryset.exists() and theme.cluster_id is not None:
        candidate_queryset = Content.objects.filter(
            cluster_memberships__cluster_id=theme.cluster_id,
            is_active=True,
        )
    ranked_contents: list[Content] = list(
        candidate_queryset.exclude(pk__in=used_content_ids)
        .annotate(
            authority_rank=Coalesce("authority_adjusted_score", 0.0),
            relevance_rank=Coalesce("relevance_score", 0.0),
        )
        .order_by("-authority_rank", "-relevance_rank", "-published_date", "-id")
        .distinct()[:MAX_SECTION_ITEMS]
    )
    if ranked_contents:
        return ranked_contents
    fallback_ranked_contents: list[Content] = list(
        candidate_queryset.annotate(
            authority_rank=Coalesce("authority_adjusted_score", 0.0),
            relevance_rank=Coalesce("relevance_score", 0.0),
        )
        .order_by("-authority_rank", "-relevance_rank", "-published_date", "-id")
        .distinct()[:MAX_SECTION_ITEMS]
    )
    return fallback_ranked_contents


def _compose_section(
    theme: ThemeSuggestion,
    supporting_contents: list[Content],
) -> dict[str, object]:
    """Compose one section payload grounded in real theme and content rows."""

    fallback_payload = _fallback_section_payload(theme, supporting_contents)
    if settings.OPENROUTER_API_KEY and supporting_contents:
        try:
            response = execute_with_resilience(
                NEWSLETTER_COMPOSITION_SKILL_NAME,
                lambda: openrouter_chat_json(
                    model=settings.AI_SUMMARIZATION_MODEL,
                    system_prompt=_newsletter_prompt_resource("section_composer"),
                    user_prompt=_build_section_prompt(
                        theme=theme,
                        supporting_contents=supporting_contents,
                        fallback_payload=fallback_payload,
                    ),
                ),
                use_circuit_breaker=True,
            )
            content_by_id = {
                _require_pk(content): content for content in supporting_contents
            }
            candidate_items: list[dict[str, object]] = []
            for fallback_item in cast(
                list[dict[str, object]], fallback_payload["items"]
            ):
                fallback_content = cast(Content, fallback_item["content"])
                content_id = _require_pk(fallback_content)
                candidate_items.append(
                    {
                        "content": content_by_id.get(content_id, fallback_content),
                        "summary": str(fallback_item["summary"]),
                        "why_it_matters": str(fallback_item["why_it_matters"]),
                    }
                )
            raw_items = response.payload.get("items")
            if isinstance(raw_items, list):
                candidate_items = []
                for index, raw_item in enumerate(raw_items[: len(supporting_contents)]):
                    if not isinstance(raw_item, dict):
                        continue
                    raw_content_id = raw_item.get("content_id")
                    try:
                        if isinstance(raw_content_id, int):
                            content_id = raw_content_id
                        elif isinstance(raw_content_id, str):
                            content_id = int(raw_content_id)
                        else:
                            raise TypeError
                    except (TypeError, ValueError):
                        content_id = _require_pk(supporting_contents[index])
                    content = content_by_id.get(content_id)
                    if content is None:
                        continue
                    candidate_items.append(
                        {
                            "content": content,
                            "summary": str(raw_item.get("summary", "")).strip()
                            or _fallback_item_summary(content),
                            "why_it_matters": str(
                                raw_item.get("why_it_matters", "")
                            ).strip()
                            or _fallback_item_why(theme, content),
                        }
                    )
            if candidate_items:
                return {
                    "section_title": str(
                        response.payload.get(
                            "section_title", fallback_payload["section_title"]
                        )
                    ).strip()
                    or str(fallback_payload["section_title"]),
                    "lede": str(
                        response.payload.get("lede", fallback_payload["lede"])
                    ).strip()
                    or str(fallback_payload["lede"]),
                    "items": candidate_items,
                    "generated_by_model": response.model,
                }
        except Exception:
            pass
    return fallback_payload


def _compose_original_pieces(
    ideas: list[OriginalContentIdea],
) -> list[dict[str, object]]:
    """Project accepted original-content ideas into draft original pieces."""

    return [
        {
            "idea": idea,
            "title": idea.angle_title,
            "pitch": idea.summary,
            "suggested_outline": idea.suggested_outline,
        }
        for idea in ideas
    ]


def _compose_intro_outro(
    *,
    project: Project,
    section_payloads: list[dict[str, object]],
    original_piece_payloads: list[dict[str, object]],
    style_examples: list[str],
) -> dict[str, object]:
    """Compose the framing title, intro, and outro for the assembled draft."""

    fallback_payload = _fallback_intro_outro(
        project=project,
        section_payloads=section_payloads,
        original_piece_payloads=original_piece_payloads,
    )
    if settings.OPENROUTER_API_KEY:
        try:
            response = execute_with_resilience(
                NEWSLETTER_COMPOSITION_SKILL_NAME,
                lambda: openrouter_chat_json(
                    model=settings.AI_SUMMARIZATION_MODEL,
                    system_prompt=_newsletter_prompt_resource("intro_outro_composer"),
                    user_prompt=_build_intro_outro_prompt(
                        project=project,
                        section_payloads=section_payloads,
                        original_piece_payloads=original_piece_payloads,
                        style_examples=style_examples,
                        fallback_payload=fallback_payload,
                    ),
                ),
                use_circuit_breaker=True,
            )
            return {
                "title": str(
                    response.payload.get("title", fallback_payload["title"])
                ).strip()
                or str(fallback_payload["title"]),
                "intro": str(
                    response.payload.get("intro", fallback_payload["intro"])
                ).strip()
                or str(fallback_payload["intro"]),
                "outro": str(
                    response.payload.get("outro", fallback_payload["outro"])
                ).strip()
                or str(fallback_payload["outro"]),
                "generated_by_model": response.model,
            }
        except Exception:
            pass
    return fallback_payload


def _coherence_suggestions(
    draft: NewsletterDraft,
    *,
    style_examples: list[str],
) -> list[str]:
    """Return lightweight coherence suggestions for the assembled draft."""

    if not settings.OPENROUTER_API_KEY:
        return []
    try:
        response = execute_with_resilience(
            NEWSLETTER_COMPOSITION_SKILL_NAME,
            lambda: openrouter_chat_json(
                model=settings.AI_RELEVANCE_MODEL,
                system_prompt=_newsletter_prompt_resource("coherence_pass"),
                user_prompt=_build_coherence_prompt(
                    draft=draft,
                    style_examples=style_examples,
                ),
            ),
            use_circuit_breaker=True,
        )
        suggestions = response.payload.get("suggestions", [])
        if isinstance(suggestions, list):
            return [
                str(suggestion).strip()
                for suggestion in suggestions
                if str(suggestion).strip()
            ]
    except Exception:
        pass
    return []


def _fallback_section_payload(
    theme: ThemeSuggestion,
    supporting_contents: list[Content],
) -> dict[str, object]:
    """Build a deterministic section payload when model composition is unavailable."""

    items = [
        {
            "content": content,
            "summary": _fallback_item_summary(content),
            "why_it_matters": _fallback_item_why(theme, content),
        }
        for content in supporting_contents
    ]
    return {
        "section_title": theme.title,
        "lede": theme.pitch.strip() or theme.why_it_matters.strip(),
        "items": items,
        "generated_by_model": "heuristic-newsletter-composition",
    }


def _fallback_intro_outro(
    *,
    project: Project,
    section_payloads: list[dict[str, object]],
    original_piece_payloads: list[dict[str, object]],
) -> dict[str, object]:
    """Build deterministic framing copy when the LLM path is unavailable."""

    section_titles = [str(payload["section_title"]) for payload in section_payloads]
    original_titles = [str(payload["title"]) for payload in original_piece_payloads]
    title = _fallback_draft_title_from_titles(project, section_titles)
    intro = (
        f"This edition for {project.name} focuses on {', '.join(section_titles[:3])}. "
        f"Each section below is grounded in recent high-relevance coverage for {project.topic_description}."
    )
    outro = (
        "Keep an eye on the original angles worth developing next: "
        + ", ".join(original_titles[:3])
        + "."
    )
    return {
        "title": title,
        "intro": intro,
        "outro": outro,
        "generated_by_model": "heuristic-newsletter-composition",
    }


def _fallback_draft_title(project: Project, themes: Iterable[ThemeSuggestion]) -> str:
    """Render one deterministic title before the framing step runs."""

    return _fallback_draft_title_from_titles(project, [theme.title for theme in themes])


def _fallback_draft_title_from_titles(
    project: Project, section_titles: list[str]
) -> str:
    """Render one deterministic title from the current theme headlines."""

    if section_titles:
        return f"{project.name}: {section_titles[0]} and more"
    return f"{project.name} newsletter draft"


def _fallback_item_summary(content: Content) -> str:
    """Return a concise deterministic summary for one draft item."""

    body = " ".join(content.content_text.split())
    if body:
        return body[:240].rstrip() + ("..." if len(body) > 240 else "")
    return content.title


def _fallback_item_why(theme: ThemeSuggestion, content: Content) -> str:
    """Tie one content item back to the accepted theme in deterministic text."""

    why_text = theme.why_it_matters.strip() or theme.pitch.strip()
    return (
        f"{why_text} This item adds supporting evidence from {content.source_plugin}."
    )


@lru_cache(maxsize=8)
def _newsletter_prompt_resource(resource_name: str) -> str:
    """Load one newsletter-composition prompt resource from disk."""

    resource_path = (
        Path(__file__).resolve().parent.parent
        / "skills"
        / NEWSLETTER_COMPOSITION_SKILL_NAME
        / "resources"
        / f"{resource_name}.md"
    )
    return resource_path.read_text(encoding="utf-8").strip()


def _build_section_prompt(
    *,
    theme: ThemeSuggestion,
    supporting_contents: list[Content],
    fallback_payload: dict[str, object],
) -> str:
    """Serialize one section-composition request into a stable prompt body."""

    return (
        f"project_topic_description:\n{theme.project.topic_description}\n\n"
        f"theme:\n{{'id': {_require_pk(theme)}, 'title': {theme.title!r}, 'pitch': {theme.pitch!r}, 'why_it_matters': {theme.why_it_matters!r}}}\n\n"
        f"supporting_contents:\n{[_serialize_content(content) for content in supporting_contents]}\n\n"
        f"fallback_payload:\n{fallback_payload}\n\n"
        "Return only a JSON object using the system prompt fields."
    )


def _build_intro_outro_prompt(
    *,
    project: Project,
    section_payloads: list[dict[str, object]],
    original_piece_payloads: list[dict[str, object]],
    style_examples: list[str],
    fallback_payload: dict[str, object],
) -> str:
    """Serialize the framing composition request into a stable prompt body."""

    return (
        f"project_topic_description:\n{project.topic_description}\n\n"
        f"section_payloads:\n{section_payloads}\n\n"
        f"original_piece_payloads:\n{[{k: v for k, v in payload.items() if k != 'idea'} for payload in original_piece_payloads]}\n\n"
        f"style_examples:\n{style_examples}\n\n"
        f"fallback_payload:\n{fallback_payload}\n\n"
        "Return only a JSON object using the system prompt fields."
    )


def _build_coherence_prompt(
    *,
    draft: NewsletterDraft,
    style_examples: list[str],
) -> str:
    """Serialize the coherence request into a stable prompt body."""

    return (
        f"draft_markdown:\n{draft.render_markdown()}\n\n"
        f"style_examples:\n{style_examples}\n\n"
        "Return only a JSON object with a suggestions array."
    )


def _serialize_content(content: Content) -> dict[str, object]:
    """Serialize one content row into a prompt-safe dictionary."""

    return {
        "id": _require_pk(content),
        "title": content.title,
        "url": content.url,
        "source_plugin": content.source_plugin,
        "published_date": content.published_date.isoformat(),
        "relevance_score": content.relevance_score,
        "authority_adjusted_score": content.authority_adjusted_score,
        "excerpt": _fallback_item_summary(content),
    }


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed composition helpers."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)
