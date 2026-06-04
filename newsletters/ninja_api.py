"""Django Ninja endpoints for project-scoped newsletter resources."""

from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError
from django.db.models import Prefetch
from django.utils import timezone
from ninja import Body, Path, Router
from ninja.errors import HttpError
from ninja.responses import Status

from core.ninja_api import api_authenticate
from digest_engine.taskiq import enqueue_task, task_always_eager
from newsletters.models import (
    IntakeAllowlist,
    NewsletterDraft,
    NewsletterDraftItem,
    NewsletterDraftOriginalPiece,
    NewsletterDraftSection,
    NewsletterDraftStatus,
    NewsletterIntake,
)
from newsletters.tasks import (
    generate_newsletter_draft,
    regenerate_newsletter_draft_section,
)
from projects.ninja_helpers import _get_project_or_404, _require_project_writable

intake_allowlist_router = Router(tags=["Ingestion"])
newsletter_intakes_router = Router(tags=["Ingestion"])
newsletter_drafts_router = Router(tags=["Newsletter Composition"])
newsletter_draft_sections_router = Router(tags=["Newsletter Composition"])
newsletter_draft_items_router = Router(tags=["Newsletter Composition"])
newsletter_draft_original_pieces_router = Router(tags=["Newsletter Composition"])


def _serialize_allowlist(entry: IntakeAllowlist) -> dict[str, Any]:
    """Return one intake allowlist response body."""

    return {
        "id": int(entry.pk),
        "project": entry.project_id,
        "sender_email": entry.sender_email,
        "is_confirmed": entry.is_confirmed,
        "confirmed_at": entry.confirmed_at.isoformat() if entry.confirmed_at else None,
        "confirmation_token": entry.confirmation_token,
        "created_at": entry.created_at.isoformat(),
    }


def _serialize_intake(intake: NewsletterIntake) -> dict[str, Any]:
    """Return one newsletter intake response body."""

    return {
        "id": int(intake.pk),
        "project": intake.project_id,
        "sender_email": intake.sender_email,
        "subject": intake.subject,
        "received_at": intake.received_at.isoformat(),
        "raw_html": intake.raw_html,
        "raw_text": intake.raw_text,
        "message_id": intake.message_id,
        "status": intake.status,
        "extraction_result": intake.extraction_result,
        "error_message": intake.error_message,
    }


def _serialize_draft_item_content(item: NewsletterDraftItem) -> dict[str, Any]:
    """Return the embedded content summary for one draft item."""

    content = item.content
    return {
        "id": content.id,
        "url": content.url,
        "title": content.title,
        "source_plugin": content.source_plugin,
        "published_date": (
            content.published_date.isoformat() if content.published_date else None
        ),
    }


def _serialize_draft(draft: NewsletterDraft) -> dict[str, Any]:
    """Return one newsletter draft response body."""

    return {
        "id": int(draft.pk),
        "project": draft.project_id,
        "title": draft.title,
        "intro": draft.intro,
        "outro": draft.outro,
        "target_publish_date": (
            draft.target_publish_date.isoformat() if draft.target_publish_date else None
        ),
        "status": draft.status,
        "generated_at": draft.generated_at.isoformat(),
        "last_edited_at": (
            draft.last_edited_at.isoformat() if draft.last_edited_at else None
        ),
        "generation_metadata": draft.generation_metadata,
        "sections": [
            _serialize_draft_section(section) for section in draft.sections.all()
        ],
        "original_pieces": [
            _serialize_original_piece(original_piece)
            for original_piece in draft.original_pieces.all()
        ],
        "rendered_markdown": draft.render_markdown(),
        "rendered_html": draft.render_html(),
    }


def _serialize_theme_suggestion(
    section: NewsletterDraftSection,
) -> dict[str, Any] | None:
    """Return the embedded accepted-theme summary for one draft section."""

    theme = section.theme_suggestion
    if theme is None:
        return None
    return {
        "id": int(theme.pk),
        "title": theme.title,
        "pitch": theme.pitch,
        "why_it_matters": theme.why_it_matters,
    }


def _serialize_draft_section(section: NewsletterDraftSection) -> dict[str, Any]:
    """Return one newsletter draft section response body."""

    return {
        "id": int(section.pk),
        "draft": section.draft_id,
        "theme_suggestion": section.theme_suggestion_id,
        "theme_suggestion_detail": _serialize_theme_suggestion(section),
        "title": section.title,
        "lede": section.lede,
        "order": section.order,
        "items": [_serialize_draft_item(item) for item in section.items.all()],
    }


def _serialize_draft_item(item: NewsletterDraftItem) -> dict[str, Any]:
    """Return one newsletter draft item response body."""

    return {
        "id": int(item.pk),
        "section": item.section_id,
        "content": item.content_id,
        "content_detail": _serialize_draft_item_content(item),
        "summary_used": item.summary_used,
        "why_it_matters": item.why_it_matters,
        "order": item.order,
    }


def _serialize_original_idea(
    original_piece: NewsletterDraftOriginalPiece,
) -> dict[str, Any]:
    """Return the embedded accepted-idea summary for one original piece."""

    idea = original_piece.idea
    return {
        "id": int(idea.pk),
        "angle_title": idea.angle_title,
        "summary": idea.summary,
        "suggested_outline": idea.suggested_outline,
    }


def _serialize_original_piece(
    original_piece: NewsletterDraftOriginalPiece,
) -> dict[str, Any]:
    """Return one newsletter draft original-piece response body."""

    return {
        "id": int(original_piece.pk),
        "draft": original_piece.draft_id,
        "idea": original_piece.idea_id,
        "idea_detail": _serialize_original_idea(original_piece),
        "title": original_piece.title,
        "pitch": original_piece.pitch,
        "suggested_outline": original_piece.suggested_outline,
        "order": original_piece.order,
    }


def _validation_error_payload(exc: ValidationError) -> dict[str, list[str]]:
    """Convert a Django validation error into the native API error payload."""

    if hasattr(exc, "message_dict"):
        return {
            field: [str(message) for message in messages]
            for field, messages in exc.message_dict.items()
        }
    return {"__all__": [str(message) for message in exc.messages]}


def _unknown_field_errors(
    payload: dict[str, Any],
    *,
    accepted_fields: set[str],
) -> dict[str, list[str]] | None:
    """Reject fields that are not part of the supported payload contract."""

    errors = {
        field_name: ["This field is not allowed."]
        for field_name in payload
        if field_name not in accepted_fields
    }
    return errors or None


def _validated_model_payload(
    instance: (
        IntakeAllowlist
        | NewsletterDraft
        | NewsletterDraftSection
        | NewsletterDraftItem
        | NewsletterDraftOriginalPiece
    ),
    payload: dict[str, Any],
    *,
    editable_fields: set[str],
    accepted_fields: set[str],
) -> tuple[dict[str, list[str]] | None, list[str]]:
    """Validate one partial model payload and return the touched field names."""

    errors = _unknown_field_errors(payload, accepted_fields=accepted_fields)
    if errors is not None:
        return errors, []

    updated_fields: list[str] = []
    for field_name in editable_fields:
        if field_name in payload:
            setattr(instance, field_name, payload[field_name])
            updated_fields.append(field_name)
    try:
        instance.full_clean()
    except ValidationError as exc:
        return _validation_error_payload(exc), updated_fields
    return None, updated_fields


def _validated_regenerate_section_payload(
    payload: dict[str, Any],
    *,
    draft: NewsletterDraft,
) -> tuple[int | None, dict[str, list[str]] | None]:
    """Validate the draft-section regeneration payload."""

    errors = _unknown_field_errors(payload, accepted_fields={"section_id"})
    if errors is not None:
        return None, errors
    if "section_id" not in payload:
        return None, {"section_id": ["This field is required."]}

    raw_section_id = payload["section_id"]
    try:
        section_id = int(raw_section_id)
    except (TypeError, ValueError):
        return None, {"section_id": ["A valid integer is required."]}

    exists = NewsletterDraftSection.objects.filter(
        pk=section_id,
        draft=draft,
        draft__project=draft.project,
    ).exists()
    if not exists:
        return None, {"section_id": ["Draft section not found for this project."]}
    return section_id, None


def _draft_queryset():
    """Return the canonical queryset for newsletter drafts."""

    return NewsletterDraft.objects.select_related("project").prefetch_related(
        Prefetch(
            "sections",
            queryset=NewsletterDraftSection.objects.select_related(
                "theme_suggestion"
            ).prefetch_related(
                Prefetch(
                    "items",
                    queryset=NewsletterDraftItem.objects.select_related("content"),
                )
            ),
        ),
        Prefetch(
            "original_pieces",
            queryset=NewsletterDraftOriginalPiece.objects.select_related("idea"),
        ),
    )


def _get_allowlist_or_404(project_id: int, allowlist_id: int) -> IntakeAllowlist:
    """Load one intake allowlist entry for the selected project."""

    entry = IntakeAllowlist.objects.filter(
        project_id=project_id, pk=allowlist_id
    ).first()
    if not entry:
        raise HttpError(404, "Not found.")
    return entry


def _get_newsletter_intake_or_404(project_id: int, intake_id: int) -> NewsletterIntake:
    """Load one newsletter intake row for the selected project."""

    intake = (
        NewsletterIntake.objects.select_related("project")
        .filter(
            project_id=project_id,
            pk=intake_id,
        )
        .first()
    )
    if not intake:
        raise HttpError(404, "Not found.")
    return intake


def _get_draft_or_404(project_id: int, draft_id: int) -> NewsletterDraft:
    """Load one newsletter draft for the selected project."""

    draft = _draft_queryset().filter(project_id=project_id, pk=draft_id).first()
    if not draft:
        raise HttpError(404, "Not found.")
    return draft


def _get_draft_section_or_404(
    project_id: int, section_id: int
) -> NewsletterDraftSection:
    """Load one newsletter draft section for the selected project."""

    section = (
        NewsletterDraftSection.objects.select_related(
            "draft",
            "theme_suggestion",
        )
        .prefetch_related(
            Prefetch(
                "items",
                queryset=NewsletterDraftItem.objects.select_related("content"),
            )
        )
        .filter(
            draft__project_id=project_id,
            pk=section_id,
        )
        .first()
    )
    if not section:
        raise HttpError(404, "Not found.")
    return section


def _get_draft_item_or_404(project_id: int, item_id: int) -> NewsletterDraftItem:
    """Load one newsletter draft item for the selected project."""

    item = (
        NewsletterDraftItem.objects.select_related(
            "section",
            "section__draft",
            "content",
        )
        .filter(
            section__draft__project_id=project_id,
            pk=item_id,
        )
        .first()
    )
    if not item:
        raise HttpError(404, "Not found.")
    return item


def _get_original_piece_or_404(
    project_id: int, original_piece_id: int
) -> NewsletterDraftOriginalPiece:
    """Load one newsletter draft original piece for the selected project."""

    original_piece = (
        NewsletterDraftOriginalPiece.objects.select_related(
            "draft",
            "idea",
        )
        .filter(
            draft__project_id=project_id,
            pk=original_piece_id,
        )
        .first()
    )
    if not original_piece:
        raise HttpError(404, "Not found.")
    return original_piece


def _mark_draft_edited(draft: NewsletterDraft) -> None:
    """Mark one newsletter draft as editor-modified."""

    draft.status = NewsletterDraftStatus.EDITED
    draft.last_edited_at = timezone.now()
    draft.save(update_fields=["status", "last_edited_at"])


@intake_allowlist_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=api_authenticate,
)
def list_intake_allowlist(request: Any, project_id: int = Path(...)):
    """List intake allowlist entries for the selected project."""

    _require_project_writable(request, project_id)
    entries = IntakeAllowlist.objects.select_related("project").filter(
        project_id=project_id
    )
    return [_serialize_allowlist(entry) for entry in entries]


@intake_allowlist_router.post(
    "/",
    response={201: dict[str, Any], 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def create_intake_allowlist(
    request: Any,
    payload: dict[str, Any] = Body(...),
    project_id: int = Path(...),
):
    """Create one intake allowlist entry for the selected project."""

    project = _require_project_writable(request, project_id)
    entry = IntakeAllowlist(project=project)
    errors, _ = _validated_model_payload(
        entry,
        payload,
        editable_fields={"sender_email"},
        accepted_fields={
            "id",
            "project",
            "sender_email",
            "is_confirmed",
            "confirmed_at",
            "confirmation_token",
            "created_at",
        },
    )
    if errors is not None:
        return Status(400, errors)
    entry.save()
    return Status(201, _serialize_allowlist(entry))


@intake_allowlist_router.get(
    "/{allowlist_id}/",
    response=dict[str, Any],
    auth=api_authenticate,
)
def get_intake_allowlist(
    request: Any,
    project_id: int = Path(...),
    allowlist_id: int = Path(...),
):
    """Return one intake allowlist entry."""

    _require_project_writable(request, project_id)
    return _serialize_allowlist(_get_allowlist_or_404(project_id, allowlist_id))


@intake_allowlist_router.patch(
    "/{allowlist_id}/",
    response={200: dict[str, Any], 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_intake_allowlist(
    request: Any,
    payload: dict[str, Any] = Body(...),
    project_id: int = Path(...),
    allowlist_id: int = Path(...),
):
    """Update one intake allowlist entry."""

    _require_project_writable(request, project_id)
    entry = _get_allowlist_or_404(project_id, allowlist_id)
    errors, updated_fields = _validated_model_payload(
        entry,
        payload,
        editable_fields={"sender_email"},
        accepted_fields={
            "id",
            "project",
            "sender_email",
            "is_confirmed",
            "confirmed_at",
            "confirmation_token",
            "created_at",
        },
    )
    if errors is not None:
        return Status(400, errors)
    if updated_fields:
        entry.save(update_fields=updated_fields)
    return _serialize_allowlist(entry)


@intake_allowlist_router.delete(
    "/{allowlist_id}/",
    response={204: None},
    auth=api_authenticate,
)
def delete_intake_allowlist(
    request: Any,
    project_id: int = Path(...),
    allowlist_id: int = Path(...),
):
    """Delete one intake allowlist entry."""

    _require_project_writable(request, project_id)
    entry = _get_allowlist_or_404(project_id, allowlist_id)
    entry.delete()
    return Status(204, None)


@newsletter_intakes_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=api_authenticate,
)
def list_newsletter_intakes(request: Any, project_id: int = Path(...)):
    """List newsletter intake rows for the selected project."""

    _get_project_or_404(request, project_id)
    intakes = NewsletterIntake.objects.select_related("project").filter(
        project_id=project_id
    )
    return [_serialize_intake(intake) for intake in intakes]


@newsletter_intakes_router.get(
    "/{intake_id}/",
    response=dict[str, Any],
    auth=api_authenticate,
)
def get_newsletter_intake(
    request: Any,
    project_id: int = Path(...),
    intake_id: int = Path(...),
):
    """Return one newsletter intake row."""

    _get_project_or_404(request, project_id)
    return _serialize_intake(_get_newsletter_intake_or_404(project_id, intake_id))


@newsletter_drafts_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=api_authenticate,
)
def list_newsletter_drafts(request: Any, project_id: int = Path(...)):
    """List newsletter drafts for the selected project."""

    _get_project_or_404(request, project_id)
    drafts = _draft_queryset().filter(project_id=project_id)
    return [_serialize_draft(draft) for draft in drafts]


@newsletter_drafts_router.post(
    "/generate/",
    response={200: dict[str, Any], 202: dict[str, Any]},
    auth=api_authenticate,
)
def generate_newsletter_draft_route(request: Any, project_id: int = Path(...)):
    """Trigger newsletter draft generation for the selected project."""

    _require_project_writable(request, project_id)
    if task_always_eager():
        result = generate_newsletter_draft(project_id)
        return Status(
            200,
            {
                "status": "completed",
                "project_id": project_id,
                "result": result,
            },
        )
    enqueue_task(generate_newsletter_draft, project_id)
    return Status(202, {"status": "queued", "project_id": project_id})


@newsletter_drafts_router.get(
    "/{draft_id}/",
    response=dict[str, Any],
    auth=api_authenticate,
)
def get_newsletter_draft(
    request: Any,
    project_id: int = Path(...),
    draft_id: int = Path(...),
):
    """Return one newsletter draft."""

    _get_project_or_404(request, project_id)
    return _serialize_draft(_get_draft_or_404(project_id, draft_id))


@newsletter_drafts_router.patch(
    "/{draft_id}/",
    response={200: dict[str, Any], 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_newsletter_draft(
    request: Any,
    payload: dict[str, Any] = Body(...),
    project_id: int = Path(...),
    draft_id: int = Path(...),
):
    """Update one newsletter draft and mark it as editor-modified."""

    _require_project_writable(request, project_id)
    draft = _get_draft_or_404(project_id, draft_id)
    errors, updated_fields = _validated_model_payload(
        draft,
        payload,
        editable_fields={"title", "intro", "outro", "target_publish_date", "status"},
        accepted_fields={
            "id",
            "project",
            "title",
            "intro",
            "outro",
            "target_publish_date",
            "status",
            "generated_at",
            "last_edited_at",
            "generation_metadata",
            "sections",
            "original_pieces",
            "rendered_markdown",
            "rendered_html",
        },
    )
    if errors is not None:
        return Status(400, errors)
    draft.status = NewsletterDraftStatus.EDITED
    draft.last_edited_at = timezone.now()
    draft.save(update_fields=sorted({*updated_fields, "status", "last_edited_at"}))
    return _serialize_draft(_get_draft_or_404(project_id, draft_id))


@newsletter_drafts_router.post(
    "/{draft_id}/regenerate_section/",
    response={200: dict[str, Any], 202: dict[str, Any], 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def regenerate_newsletter_draft_section_route(
    request: Any,
    payload: dict[str, Any] = Body(...),
    project_id: int = Path(...),
    draft_id: int = Path(...),
):
    """Recompose one section inside the selected newsletter draft."""

    _require_project_writable(request, project_id)
    draft = _get_draft_or_404(project_id, draft_id)
    section_id, errors = _validated_regenerate_section_payload(payload, draft=draft)
    if errors is not None or section_id is None:
        return Status(400, errors or {"section_id": ["This field is required."]})
    if task_always_eager():
        regenerate_newsletter_draft_section(section_id)
        draft.refresh_from_db()
        return _serialize_draft(_get_draft_or_404(project_id, draft_id))
    enqueue_task(regenerate_newsletter_draft_section, section_id)
    return Status(
        202,
        {
            "status": "queued",
            "draft_id": int(draft.pk),
            "section_id": section_id,
        },
    )


@newsletter_draft_sections_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=api_authenticate,
)
def list_newsletter_draft_sections(request: Any, project_id: int = Path(...)):
    """List newsletter draft sections for the selected project."""

    _get_project_or_404(request, project_id)
    sections = (
        NewsletterDraftSection.objects.select_related(
            "draft",
            "theme_suggestion",
        )
        .prefetch_related(
            Prefetch(
                "items",
                queryset=NewsletterDraftItem.objects.select_related("content"),
            )
        )
        .filter(draft__project_id=project_id)
    )
    return [_serialize_draft_section(section) for section in sections]


@newsletter_draft_sections_router.get(
    "/{section_id}/",
    response=dict[str, Any],
    auth=api_authenticate,
)
def get_newsletter_draft_section(
    request: Any,
    project_id: int = Path(...),
    section_id: int = Path(...),
):
    """Return one newsletter draft section."""

    _get_project_or_404(request, project_id)
    return _serialize_draft_section(_get_draft_section_or_404(project_id, section_id))


@newsletter_draft_sections_router.patch(
    "/{section_id}/",
    response={200: dict[str, Any], 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_newsletter_draft_section(
    request: Any,
    payload: dict[str, Any] = Body(...),
    project_id: int = Path(...),
    section_id: int = Path(...),
):
    """Update one newsletter draft section and mark its draft as edited."""

    _require_project_writable(request, project_id)
    section = _get_draft_section_or_404(project_id, section_id)
    errors, updated_fields = _validated_model_payload(
        section,
        payload,
        editable_fields={"title", "lede", "order"},
        accepted_fields={
            "id",
            "draft",
            "theme_suggestion",
            "theme_suggestion_detail",
            "title",
            "lede",
            "order",
            "items",
        },
    )
    if errors is not None:
        return Status(400, errors)
    if updated_fields:
        section.save(update_fields=updated_fields)
    _mark_draft_edited(section.draft)
    return _serialize_draft_section(_get_draft_section_or_404(project_id, section_id))


@newsletter_draft_sections_router.delete(
    "/{section_id}/",
    response={204: None},
    auth=api_authenticate,
)
def delete_newsletter_draft_section(
    request: Any,
    project_id: int = Path(...),
    section_id: int = Path(...),
):
    """Delete one newsletter draft section and mark its draft as edited."""

    _require_project_writable(request, project_id)
    section = _get_draft_section_or_404(project_id, section_id)
    draft = section.draft
    section.delete()
    _mark_draft_edited(draft)
    return Status(204, None)


@newsletter_draft_items_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=api_authenticate,
)
def list_newsletter_draft_items(request: Any, project_id: int = Path(...)):
    """List newsletter draft items for the selected project."""

    _get_project_or_404(request, project_id)
    items = NewsletterDraftItem.objects.select_related(
        "section",
        "section__draft",
        "content",
    ).filter(section__draft__project_id=project_id)
    return [_serialize_draft_item(item) for item in items]


@newsletter_draft_items_router.get(
    "/{item_id}/",
    response=dict[str, Any],
    auth=api_authenticate,
)
def get_newsletter_draft_item(
    request: Any,
    project_id: int = Path(...),
    item_id: int = Path(...),
):
    """Return one newsletter draft item."""

    _get_project_or_404(request, project_id)
    return _serialize_draft_item(_get_draft_item_or_404(project_id, item_id))


@newsletter_draft_items_router.patch(
    "/{item_id}/",
    response={200: dict[str, Any], 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_newsletter_draft_item(
    request: Any,
    payload: dict[str, Any] = Body(...),
    project_id: int = Path(...),
    item_id: int = Path(...),
):
    """Update one newsletter draft item and mark its draft as edited."""

    _require_project_writable(request, project_id)
    item = _get_draft_item_or_404(project_id, item_id)
    errors, updated_fields = _validated_model_payload(
        item,
        payload,
        editable_fields={"summary_used", "why_it_matters", "order"},
        accepted_fields={
            "id",
            "section",
            "content",
            "content_detail",
            "summary_used",
            "why_it_matters",
            "order",
        },
    )
    if errors is not None:
        return Status(400, errors)
    if updated_fields:
        item.save(update_fields=updated_fields)
    _mark_draft_edited(item.section.draft)
    return _serialize_draft_item(_get_draft_item_or_404(project_id, item_id))


@newsletter_draft_items_router.delete(
    "/{item_id}/",
    response={204: None},
    auth=api_authenticate,
)
def delete_newsletter_draft_item(
    request: Any,
    project_id: int = Path(...),
    item_id: int = Path(...),
):
    """Delete one newsletter draft item and mark its draft as edited."""

    _require_project_writable(request, project_id)
    item = _get_draft_item_or_404(project_id, item_id)
    draft = item.section.draft
    item.delete()
    _mark_draft_edited(draft)
    return Status(204, None)


@newsletter_draft_original_pieces_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=api_authenticate,
)
def list_newsletter_draft_original_pieces(request: Any, project_id: int = Path(...)):
    """List newsletter draft original pieces for the selected project."""

    _get_project_or_404(request, project_id)
    original_pieces = NewsletterDraftOriginalPiece.objects.select_related(
        "draft",
        "idea",
    ).filter(draft__project_id=project_id)
    return [
        _serialize_original_piece(original_piece) for original_piece in original_pieces
    ]


@newsletter_draft_original_pieces_router.get(
    "/{original_piece_id}/",
    response=dict[str, Any],
    auth=api_authenticate,
)
def get_newsletter_draft_original_piece(
    request: Any,
    project_id: int = Path(...),
    original_piece_id: int = Path(...),
):
    """Return one newsletter draft original piece."""

    _get_project_or_404(request, project_id)
    return _serialize_original_piece(
        _get_original_piece_or_404(project_id, original_piece_id)
    )


@newsletter_draft_original_pieces_router.patch(
    "/{original_piece_id}/",
    response={200: dict[str, Any], 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_newsletter_draft_original_piece(
    request: Any,
    payload: dict[str, Any] = Body(...),
    project_id: int = Path(...),
    original_piece_id: int = Path(...),
):
    """Update one newsletter draft original piece and mark its draft as edited."""

    _require_project_writable(request, project_id)
    original_piece = _get_original_piece_or_404(project_id, original_piece_id)
    errors, updated_fields = _validated_model_payload(
        original_piece,
        payload,
        editable_fields={"title", "pitch", "suggested_outline", "order"},
        accepted_fields={
            "id",
            "draft",
            "idea",
            "idea_detail",
            "title",
            "pitch",
            "suggested_outline",
            "order",
        },
    )
    if errors is not None:
        return Status(400, errors)
    if updated_fields:
        original_piece.save(update_fields=updated_fields)
    _mark_draft_edited(original_piece.draft)
    return _serialize_original_piece(
        _get_original_piece_or_404(project_id, original_piece_id)
    )


@newsletter_draft_original_pieces_router.delete(
    "/{original_piece_id}/",
    response={204: None},
    auth=api_authenticate,
)
def delete_newsletter_draft_original_piece(
    request: Any,
    project_id: int = Path(...),
    original_piece_id: int = Path(...),
):
    """Delete one newsletter draft original piece and mark its draft as edited."""

    _require_project_writable(request, project_id)
    original_piece = _get_original_piece_or_404(project_id, original_piece_id)
    draft = original_piece.draft
    original_piece.delete()
    _mark_draft_edited(draft)
    return Status(204, None)


__all__ = [
    "intake_allowlist_router",
    "newsletter_intakes_router",
    "newsletter_drafts_router",
    "newsletter_draft_sections_router",
    "newsletter_draft_items_router",
    "newsletter_draft_original_pieces_router",
]
