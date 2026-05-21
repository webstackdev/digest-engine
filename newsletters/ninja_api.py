"""Django Ninja endpoints for project-scoped newsletter resources."""

from __future__ import annotations

from typing import Any, cast

from django.conf import settings
from django.db.models import Prefetch
from django.utils import timezone
from ninja import Body, Path, Router
from ninja.errors import HttpError

from core.ninja_api import drf_authenticate
from newsletters.models import (
    IntakeAllowlist,
    NewsletterDraft,
    NewsletterDraftItem,
    NewsletterDraftOriginalPiece,
    NewsletterDraftSection,
    NewsletterDraftStatus,
    NewsletterIntake,
)
from newsletters.serializers import (
    IntakeAllowlistSerializer,
    NewsletterDraftItemSerializer,
    NewsletterDraftOriginalPieceSerializer,
    NewsletterDraftRegenerateSectionSerializer,
    NewsletterDraftSectionSerializer,
    NewsletterDraftSerializer,
    NewsletterIntakeSerializer,
)
from newsletters.tasks import (
    generate_newsletter_draft,
    regenerate_newsletter_draft_section,
)
from projects.ninja_api import _get_project_or_404, _require_project_writable

intake_allowlist_router = Router(tags=["Ingestion"])
newsletter_intakes_router = Router(tags=["Ingestion"])
newsletter_drafts_router = Router(tags=["Newsletter Composition"])
newsletter_draft_sections_router = Router(tags=["Newsletter Composition"])
newsletter_draft_items_router = Router(tags=["Newsletter Composition"])
newsletter_draft_original_pieces_router = Router(tags=["Newsletter Composition"])


def _serialize_allowlist(entry: IntakeAllowlist) -> dict[str, Any]:
    """Return one intake allowlist response body."""

    return cast(dict[str, Any], IntakeAllowlistSerializer(entry).data)


def _serialize_intake(intake: NewsletterIntake) -> dict[str, Any]:
    """Return one newsletter intake response body."""

    return cast(dict[str, Any], NewsletterIntakeSerializer(intake).data)


def _serialize_draft(draft: NewsletterDraft) -> dict[str, Any]:
    """Return one newsletter draft response body."""

    return cast(dict[str, Any], NewsletterDraftSerializer(draft).data)


def _serialize_draft_section(section: NewsletterDraftSection) -> dict[str, Any]:
    """Return one newsletter draft section response body."""

    return cast(dict[str, Any], NewsletterDraftSectionSerializer(section).data)


def _serialize_draft_item(item: NewsletterDraftItem) -> dict[str, Any]:
    """Return one newsletter draft item response body."""

    return cast(dict[str, Any], NewsletterDraftItemSerializer(item).data)


def _serialize_original_piece(
    original_piece: NewsletterDraftOriginalPiece,
) -> dict[str, Any]:
    """Return one newsletter draft original-piece response body."""

    return cast(
        dict[str, Any],
        NewsletterDraftOriginalPieceSerializer(original_piece).data,
    )


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
    auth=drf_authenticate,
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
    response={201: dict[str, Any]},
    auth=drf_authenticate,
)
def create_intake_allowlist(
    request: Any,
    payload: dict[str, Any] = Body(...),
    project_id: int = Path(...),
):
    """Create one intake allowlist entry for the selected project."""

    project = _require_project_writable(request, project_id)
    serializer = IntakeAllowlistSerializer(
        data=payload,
        context={"project": project, "request": request},
    )
    serializer.is_valid(raise_exception=True)
    entry = serializer.save(project=project)
    return 201, _serialize_allowlist(entry)


@intake_allowlist_router.get(
    "/{allowlist_id}/",
    response=dict[str, Any],
    auth=drf_authenticate,
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
    response=dict[str, Any],
    auth=drf_authenticate,
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
    serializer = IntakeAllowlistSerializer(
        entry,
        data=payload,
        partial=True,
        context={"project": entry.project, "request": request},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_allowlist(entry)


@intake_allowlist_router.delete(
    "/{allowlist_id}/",
    response={204: None},
    auth=drf_authenticate,
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
    return 204, None


@newsletter_intakes_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=drf_authenticate,
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
    auth=drf_authenticate,
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
    auth=drf_authenticate,
)
def list_newsletter_drafts(request: Any, project_id: int = Path(...)):
    """List newsletter drafts for the selected project."""

    _get_project_or_404(request, project_id)
    drafts = _draft_queryset().filter(project_id=project_id)
    return [_serialize_draft(draft) for draft in drafts]


@newsletter_drafts_router.post(
    "/generate/",
    response={200: dict[str, Any], 202: dict[str, Any]},
    auth=drf_authenticate,
)
def generate_newsletter_draft_route(request: Any, project_id: int = Path(...)):
    """Trigger newsletter draft generation for the selected project."""

    _require_project_writable(request, project_id)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        result = generate_newsletter_draft(project_id)
        return 200, {
            "status": "completed",
            "project_id": project_id,
            "result": result,
        }
    generate_newsletter_draft.delay(project_id)
    return 202, {"status": "queued", "project_id": project_id}


@newsletter_drafts_router.get(
    "/{draft_id}/",
    response=dict[str, Any],
    auth=drf_authenticate,
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
    response=dict[str, Any],
    auth=drf_authenticate,
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
    serializer = NewsletterDraftSerializer(
        draft,
        data=payload,
        partial=True,
        context={"project": draft.project, "request": request},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save(
        status=NewsletterDraftStatus.EDITED,
        last_edited_at=timezone.now(),
    )
    return _serialize_draft(_get_draft_or_404(project_id, draft_id))


@newsletter_drafts_router.post(
    "/{draft_id}/regenerate_section/",
    response={200: dict[str, Any], 202: dict[str, Any]},
    auth=drf_authenticate,
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
    serializer = NewsletterDraftRegenerateSectionSerializer(
        data=payload,
        context={"project": draft.project, "draft": draft, "request": request},
    )
    serializer.is_valid(raise_exception=True)
    section_id = serializer.validated_data["section_id"]
    if settings.CELERY_TASK_ALWAYS_EAGER:
        regenerate_newsletter_draft_section(section_id)
        draft.refresh_from_db()
        return _serialize_draft(_get_draft_or_404(project_id, draft_id))
    regenerate_newsletter_draft_section.delay(section_id)
    return 202, {
        "status": "queued",
        "draft_id": int(draft.pk),
        "section_id": section_id,
    }


@newsletter_draft_sections_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=drf_authenticate,
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
    auth=drf_authenticate,
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
    response=dict[str, Any],
    auth=drf_authenticate,
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
    serializer = NewsletterDraftSectionSerializer(section, data=payload, partial=True)
    serializer.is_valid(raise_exception=True)
    updated_section = serializer.save()
    _mark_draft_edited(updated_section.draft)
    return _serialize_draft_section(_get_draft_section_or_404(project_id, section_id))


@newsletter_draft_sections_router.delete(
    "/{section_id}/",
    response={204: None},
    auth=drf_authenticate,
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
    return 204, None


@newsletter_draft_items_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=drf_authenticate,
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
    auth=drf_authenticate,
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
    response=dict[str, Any],
    auth=drf_authenticate,
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
    serializer = NewsletterDraftItemSerializer(item, data=payload, partial=True)
    serializer.is_valid(raise_exception=True)
    updated_item = serializer.save()
    _mark_draft_edited(updated_item.section.draft)
    return _serialize_draft_item(_get_draft_item_or_404(project_id, item_id))


@newsletter_draft_items_router.delete(
    "/{item_id}/",
    response={204: None},
    auth=drf_authenticate,
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
    return 204, None


@newsletter_draft_original_pieces_router.get(
    "/",
    response=list[dict[str, Any]],
    auth=drf_authenticate,
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
    auth=drf_authenticate,
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
    response=dict[str, Any],
    auth=drf_authenticate,
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
    serializer = NewsletterDraftOriginalPieceSerializer(
        original_piece,
        data=payload,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    updated_original_piece = serializer.save()
    _mark_draft_edited(updated_original_piece.draft)
    return _serialize_original_piece(
        _get_original_piece_or_404(project_id, original_piece_id)
    )


@newsletter_draft_original_pieces_router.delete(
    "/{original_piece_id}/",
    response={204: None},
    auth=drf_authenticate,
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
    return 204, None


__all__ = [
    "intake_allowlist_router",
    "newsletter_intakes_router",
    "newsletter_drafts_router",
    "newsletter_draft_sections_router",
    "newsletter_draft_items_router",
    "newsletter_draft_original_pieces_router",
]
