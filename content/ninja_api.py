"""Django Ninja endpoints for project-scoped content resources."""

from __future__ import annotations

import datetime
from typing import Any

from django.core.exceptions import ValidationError
from ninja import Path, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status

from content.models import Content, UserFeedback
from core.ninja_api import drf_authenticate
from entities.models import Entity
from projects.models import ProjectMembership, ProjectRole
from projects.ninja_api import (
    _get_project_or_404,
    _require_project_admin,
    _require_project_writable,
)

content_router = Router(tags=["Content Library"])
feedback_router = Router(tags=["Feedback"])

CLASSIFICATION_SKILL_NAME = "content_classification"
RELEVANCE_SKILL_NAME = "relevance_scoring"
SUMMARIZATION_SKILL_NAME = "summarization"
RELATED_CONTENT_SKILL_NAME = "find_related"

SUPPORTED_SKILL_NAMES = {
    CLASSIFICATION_SKILL_NAME,
    RELEVANCE_SKILL_NAME,
    SUMMARIZATION_SKILL_NAME,
    RELATED_CONTENT_SKILL_NAME,
}
QUEUED_SKILL_NAMES = {RELEVANCE_SKILL_NAME, SUMMARIZATION_SKILL_NAME}


class ContentSchema(Schema):
    """Serialized content payload."""

    id: int
    project: int
    url: str
    title: str
    author: str
    entity: int | None = None
    source_plugin: str
    content_type: str
    canonical_url: str
    published_date: datetime.datetime
    ingested_at: datetime.datetime
    content_text: str
    summary_text: str
    relevance_score: float | None = None
    authority_adjusted_score: float | None = None
    embedding_id: str
    source_metadata: dict[str, Any]
    duplicate_of: int | None = None
    duplicate_signal_count: int
    is_reference: bool
    is_active: bool
    newsletter_promotion_at: datetime.datetime | None = None
    newsletter_promotion_by: int | None = None
    newsletter_promotion_theme: int | None = None


class ContentCreateInput(Schema):
    """Writable content fields for create requests."""

    url: str
    title: str
    author: str = ""
    entity: int | None = None
    source_plugin: str
    content_type: str = ""
    published_date: datetime.datetime
    content_text: str
    source_metadata: dict[str, Any] | None = None
    is_reference: bool = False
    is_active: bool = True
    project: int | None = None


class ContentUpdateInput(Schema):
    """Writable content fields for update requests."""

    url: str | None = None
    title: str | None = None
    author: str | None = None
    entity: int | None = None
    source_plugin: str | None = None
    content_type: str | None = None
    published_date: datetime.datetime | None = None
    content_text: str | None = None
    source_metadata: dict[str, Any] | None = None
    is_reference: bool | None = None
    is_active: bool | None = None
    project: int | None = None


class SkillResultSchema(Schema):
    """Serialized ad hoc skill execution payload."""

    id: int
    content: int
    project: int
    skill_name: str
    status: str
    result_data: dict[str, Any] | list[Any] | None = None
    error_message: str
    model_used: str
    latency_ms: int | None = None
    confidence: float | None = None
    invocation_id: str
    created_at: datetime.datetime
    superseded_by: int | None = None


class UserFeedbackSchema(Schema):
    """Serialized content feedback payload."""

    id: int
    content: int
    project: int
    user: int
    feedback_type: str
    created_at: datetime.datetime


class UserFeedbackCreateInput(Schema):
    """Writable feedback fields for create requests."""

    content: int
    feedback_type: str


class UserFeedbackUpdateInput(Schema):
    """Writable feedback fields for update requests."""

    content: int | None = None
    feedback_type: str | None = None


def _serialize_content(content: Content) -> dict[str, Any]:
    """Return one content response body."""

    return {
        "id": int(content.pk),
        "project": content.project_id,
        "url": content.url,
        "title": content.title,
        "author": content.author,
        "entity": content.entity_id,
        "source_plugin": content.source_plugin,
        "content_type": content.content_type,
        "canonical_url": content.canonical_url,
        "published_date": content.published_date,
        "ingested_at": content.ingested_at,
        "content_text": content.content_text,
        "summary_text": content.summary_text,
        "relevance_score": content.relevance_score,
        "authority_adjusted_score": content.authority_adjusted_score,
        "embedding_id": content.embedding_id,
        "source_metadata": content.source_metadata,
        "duplicate_of": content.duplicate_of_id,
        "duplicate_signal_count": content.duplicate_signal_count,
        "is_reference": content.is_reference,
        "is_active": content.is_active,
        "newsletter_promotion_at": content.newsletter_promotion_at,
        "newsletter_promotion_by": content.newsletter_promotion_by_id,
        "newsletter_promotion_theme": content.newsletter_promotion_theme_id,
    }


def _serialize_skill_result(skill_result: Any) -> dict[str, Any]:
    """Return one persisted skill result response body."""

    return {
        "id": int(skill_result.pk),
        "content": skill_result.content_id,
        "project": skill_result.project_id,
        "skill_name": skill_result.skill_name,
        "status": skill_result.status,
        "result_data": skill_result.result_data,
        "error_message": skill_result.error_message,
        "model_used": skill_result.model_used,
        "latency_ms": skill_result.latency_ms,
        "confidence": skill_result.confidence,
        "invocation_id": str(skill_result.invocation_id),
        "created_at": skill_result.created_at,
        "superseded_by": skill_result.superseded_by_id,
    }


def _serialize_feedback(feedback: UserFeedback) -> dict[str, Any]:
    """Return one feedback response body."""

    return {
        "id": int(feedback.pk),
        "content": feedback.content_id,
        "project": feedback.project_id,
        "user": feedback.user_id,
        "feedback_type": feedback.feedback_type,
        "created_at": feedback.created_at,
    }


def _validation_error_payload(exc: ValidationError) -> dict[str, list[str]]:
    """Convert a Django validation error into the Ninja error payload shape."""

    if hasattr(exc, "message_dict"):
        return {
            field: [str(message) for message in messages]
            for field, messages in exc.message_dict.items()
        }
    return {"__all__": [str(message) for message in exc.messages]}


def _error_payload(field: str, message: str) -> dict[str, list[str]]:
    """Return the native Ninja error payload shape."""

    return {field: [message]}


def _resolve_entity_for_project(
    entity_id: int | None,
    *,
    project_id: int,
) -> tuple[Entity | None, dict[str, list[str]] | None]:
    """Resolve one entity reference and enforce project ownership."""

    if entity_id is None:
        return None, None
    entity = Entity.objects.filter(pk=entity_id).first()
    if entity is None or entity.project_id != project_id:
        return None, _error_payload(
            "entity", "Entity must belong to the selected project."
        )
    return entity, None


def _validated_content_payload(
    payload: dict[str, Any],
    *,
    project,
    instance: Content | None = None,
) -> tuple[dict[str, Any], dict[str, list[str]] | None]:
    """Normalize and validate one content payload."""

    validated_payload = dict(payload)
    validated_payload.pop("project", None)

    entity = instance.entity if instance is not None else None
    if "entity" in validated_payload:
        entity, entity_errors = _resolve_entity_for_project(
            validated_payload.pop("entity"),
            project_id=project.id,
        )
        if entity_errors is not None:
            return validated_payload, entity_errors

    content = instance or Content(project=project)
    for field_name, value in validated_payload.items():
        setattr(content, field_name, value)
    content.entity = entity
    try:
        content.full_clean()
    except ValidationError as exc:
        return validated_payload, _validation_error_payload(exc)

    validated_payload["entity"] = entity
    return validated_payload, None


def _resolve_feedback_content(
    content_id: int,
    *,
    project_id: int,
) -> tuple[Content | None, dict[str, list[str]] | None]:
    """Resolve one content reference for feedback and enforce project ownership."""

    content = Content.objects.filter(pk=content_id).first()
    if content is None or content.project_id != project_id:
        return None, _error_payload(
            "content", "Content must belong to the selected project."
        )
    return content, None


def _validated_feedback_payload(
    payload: dict[str, Any],
    *,
    project,
    user,
    instance: UserFeedback | None = None,
) -> tuple[dict[str, Any], dict[str, list[str]] | None]:
    """Normalize and validate one feedback payload."""

    validated_payload = dict(payload)
    content = instance.content if instance is not None else None
    if "content" in validated_payload:
        content, content_errors = _resolve_feedback_content(
            validated_payload.pop("content"),
            project_id=project.id,
        )
        if content_errors is not None:
            return validated_payload, content_errors

    feedback = instance or UserFeedback(project=project, user=user)
    for field_name, value in validated_payload.items():
        setattr(feedback, field_name, value)
    feedback.project = project
    feedback.user = user
    feedback.content = content
    try:
        feedback.full_clean()
    except ValidationError as exc:
        return validated_payload, _validation_error_payload(exc)

    validated_payload["content"] = content
    return validated_payload, None


def _get_content_or_404(project_id: int, content_id: int) -> Content:
    """Load one content row for the selected project."""

    content = (
        Content.objects.select_related("project", "entity")
        .filter(project_id=project_id, pk=content_id)
        .first()
    )
    if not content:
        raise HttpError(404, "Not found.")
    return content


def _get_feedback_or_404(project_id: int, feedback_id: int) -> UserFeedback:
    """Load one feedback row for the selected project."""

    feedback = (
        UserFeedback.objects.select_related("content", "project", "user")
        .filter(project_id=project_id, pk=feedback_id)
        .first()
    )
    if not feedback:
        raise HttpError(404, "Not found.")
    return feedback


def _require_feedback_editor(request: Any, feedback: UserFeedback) -> None:
    """Require admin access or ownership for one feedback mutation."""

    membership = ProjectMembership.objects.filter(
        project=feedback.project,
        user=request.user,
    ).first()
    if not membership:
        raise HttpError(403, "You do not have permission to perform this action.")
    if membership.role == ProjectRole.ADMIN:
        return
    if membership.role == ProjectRole.MEMBER and feedback.user_id == request.user.id:
        return
    raise HttpError(403, "You do not have permission to perform this action.")


@content_router.get("/", response=list[ContentSchema], auth=drf_authenticate)
def list_contents(request: Any, project_id: int = Path(...)):
    """List content rows visible to the current project member."""

    _get_project_or_404(request, project_id)
    contents = Content.objects.select_related("project", "entity").filter(
        project_id=project_id
    )
    return [_serialize_content(content) for content in contents]


@content_router.post(
    "/",
    response={201: ContentSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def create_content(
    request: Any,
    payload: ContentCreateInput,
    project_id: int = Path(...),
):
    """Create one content row under the selected project."""

    project = _require_project_writable(request, project_id)
    validated_payload, errors = _validated_content_payload(
        payload.model_dump(exclude_unset=True, exclude_none=False),
        project=project,
    )
    if errors is not None:
        return Status(400, errors)
    content = Content.objects.create(project=project, **validated_payload)
    return Status(201, _serialize_content(content))


@content_router.get(
    "/{content_id}/",
    response=ContentSchema,
    auth=drf_authenticate,
)
def get_content(
    request: Any,
    project_id: int = Path(...),
    content_id: int = Path(...),
):
    """Return one content row."""

    _get_project_or_404(request, project_id)
    return _serialize_content(_get_content_or_404(project_id, content_id))


@content_router.patch(
    "/{content_id}/",
    response={200: ContentSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def update_content(
    request: Any,
    payload: ContentUpdateInput,
    project_id: int = Path(...),
    content_id: int = Path(...),
):
    """Update one content row."""

    _require_project_writable(request, project_id)
    content = _get_content_or_404(project_id, content_id)
    validated_payload, errors = _validated_content_payload(
        payload.model_dump(exclude_unset=True, exclude_none=False),
        project=content.project,
        instance=content,
    )
    if errors is not None:
        return Status(400, errors)
    for field_name, value in validated_payload.items():
        setattr(content, field_name, value)
    content.save()
    return _serialize_content(content)


@content_router.delete(
    "/{content_id}/",
    response={204: None},
    auth=drf_authenticate,
)
def delete_content(
    request: Any,
    project_id: int = Path(...),
    content_id: int = Path(...),
):
    """Delete one content row."""

    _require_project_admin(request, project_id)
    content = _get_content_or_404(project_id, content_id)
    content.delete()
    return Status(204, None)


@content_router.post(
    "/{content_id}/skills/{skill_name}/",
    response={
        201: SkillResultSchema,
        202: SkillResultSchema,
        400: dict[str, list[str]],
    },
    auth=drf_authenticate,
)
def run_content_skill(
    request: Any,
    project_id: int = Path(...),
    content_id: int = Path(...),
    skill_name: str = Path(...),
):
    """Run one supported ad hoc skill for a content row."""

    _require_project_writable(request, project_id)
    if skill_name not in SUPPORTED_SKILL_NAMES:
        return Status(
            400,
            {
                "skill_name": [
                    "Unsupported skill. Choose one of: content_classification, relevance_scoring, summarization, find_related."
                ]
            },
        )

    content = _get_content_or_404(project_id, content_id)
    if skill_name in QUEUED_SKILL_NAMES:
        from core.tasks import queue_content_skill

        skill_result = queue_content_skill(content, skill_name)
        return Status(202, _serialize_skill_result(skill_result))

    from core.pipeline import execute_ad_hoc_skill

    skill_result = execute_ad_hoc_skill(content, skill_name)
    return Status(201, _serialize_skill_result(skill_result))


@feedback_router.get("/", response=list[UserFeedbackSchema], auth=drf_authenticate)
def list_feedback(request: Any, project_id: int = Path(...)):
    """List feedback rows visible to the current project member."""

    _get_project_or_404(request, project_id)
    feedback_rows = UserFeedback.objects.select_related(
        "content", "project", "user"
    ).filter(project_id=project_id)
    return [_serialize_feedback(feedback) for feedback in feedback_rows]


@feedback_router.post(
    "/",
    response={201: UserFeedbackSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def create_feedback(
    request: Any,
    payload: UserFeedbackCreateInput,
    project_id: int = Path(...),
):
    """Create one feedback row and attach the authenticated user."""

    project = _require_project_writable(request, project_id)
    validated_payload, errors = _validated_feedback_payload(
        payload.model_dump(exclude_unset=True),
        project=project,
        user=request.user,
    )
    if errors is not None:
        return Status(400, errors)
    feedback = UserFeedback.objects.create(
        project=project,
        user=request.user,
        **validated_payload,
    )
    return Status(201, _serialize_feedback(feedback))


@feedback_router.get(
    "/{feedback_id}/",
    response=UserFeedbackSchema,
    auth=drf_authenticate,
)
def get_feedback(
    request: Any,
    project_id: int = Path(...),
    feedback_id: int = Path(...),
):
    """Return one feedback row."""

    _get_project_or_404(request, project_id)
    return _serialize_feedback(_get_feedback_or_404(project_id, feedback_id))


@feedback_router.patch(
    "/{feedback_id}/",
    response={200: UserFeedbackSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def update_feedback(
    request: Any,
    payload: UserFeedbackUpdateInput,
    project_id: int = Path(...),
    feedback_id: int = Path(...),
):
    """Update one feedback row, requiring admin access or ownership."""

    feedback = _get_feedback_or_404(project_id, feedback_id)
    _require_feedback_editor(request, feedback)
    validated_payload, errors = _validated_feedback_payload(
        payload.model_dump(exclude_unset=True),
        project=feedback.project,
        user=feedback.user,
        instance=feedback,
    )
    if errors is not None:
        return Status(400, errors)
    for field_name, value in validated_payload.items():
        setattr(feedback, field_name, value)
    feedback.save()
    return _serialize_feedback(feedback)


@feedback_router.delete(
    "/{feedback_id}/",
    response={204: None},
    auth=drf_authenticate,
)
def delete_feedback(
    request: Any,
    project_id: int = Path(...),
    feedback_id: int = Path(...),
):
    """Delete one feedback row, requiring admin access or ownership."""

    feedback = _get_feedback_or_404(project_id, feedback_id)
    _require_feedback_editor(request, feedback)
    feedback.delete()
    return Status(204, None)


__all__ = ["content_router", "feedback_router"]
