"""Django Ninja endpoints for project-scoped pipeline resources."""

from __future__ import annotations

import datetime
from typing import Any

from django.conf import settings
from django.utils import timezone
from ninja import Path, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status

from content.models import Content
from core.ninja_api import drf_authenticate
from core.tasks import retry_pipeline_review_item
from pipeline.models import (
    ReviewQueue,
    ReviewResolution,
    SkillResult,
)
from projects.models import Project, ProjectMembership, ProjectRole
from projects.ninja_api import _get_project_or_404

router = Router(tags=["AI Processing"])


class SkillResultSchema(Schema):
    """Serialized pipeline skill result payload."""

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


class SkillResultCreateInput(Schema):
    """Writable fields for creating one skill result."""

    content: int
    skill_name: str
    status: str
    result_data: dict[str, Any] | list[Any] | None = None
    error_message: str = ""
    model_used: str = ""
    latency_ms: int | None = None
    confidence: float | None = None
    superseded_by: int | None = None


class SkillResultUpdateInput(Schema):
    """Writable fields for partially updating one skill result."""

    content: int | None = None
    skill_name: str | None = None
    status: str | None = None
    result_data: dict[str, Any] | list[Any] | None = None
    error_message: str | None = None
    model_used: str | None = None
    latency_ms: int | None = None
    confidence: float | None = None
    superseded_by: int | None = None


class ReviewQueueItemSchema(Schema):
    """Serialized pipeline review-queue payload."""

    id: int
    project: int
    content: int
    reason: str
    confidence: float
    failed_node: str
    failure_detail: str
    skill_invocation_id: str | None = None
    created_at: datetime.datetime
    resolved: bool
    resolved_at: datetime.datetime | None = None
    resolution: str


class ReviewQueueCreateInput(Schema):
    """Writable fields for creating one review-queue item."""

    content: int
    reason: str
    confidence: float
    failed_node: str = ""
    failure_detail: str = ""
    skill_invocation_id: str | None = None
    resolved: bool = False
    resolved_at: datetime.datetime | None = None
    resolution: str = ""


class ReviewQueueUpdateInput(Schema):
    """Writable fields for partially updating one review-queue item."""

    content: int | None = None
    reason: str | None = None
    confidence: float | None = None
    failed_node: str | None = None
    failure_detail: str | None = None
    skill_invocation_id: str | None = None
    resolved: bool | None = None
    resolved_at: datetime.datetime | None = None
    resolution: str | None = None


class ReviewQueueRetryQueuedSchema(Schema):
    """Queued retry response for one review item."""

    review_item_id: int
    status: str


def _require_pk(instance: Any) -> int:
    """Return a saved model primary key as an integer."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _require_project_member(request: Any, project_id: int) -> Project:
    """Load one project if the current user can read project-scoped pipeline data."""

    return _get_project_or_404(request, project_id)


def _require_project_contributor(request: Any, project_id: int) -> Project:
    """Load one project if the current user can mutate project-scoped pipeline data."""

    project = _get_project_or_404(request, project_id)
    membership = ProjectMembership.objects.filter(
        project=project,
        user=request.user,
    ).first()
    if not membership or membership.role not in {ProjectRole.ADMIN, ProjectRole.MEMBER}:
        raise HttpError(403, "You do not have permission to perform this action.")
    return project


def _get_skill_result_or_404(project_id: int, skill_result_id: int) -> SkillResult:
    """Return one project-scoped skill result or raise 404."""

    skill_result = (
        SkillResult.objects.select_related("content", "project", "superseded_by")
        .filter(project_id=project_id, pk=skill_result_id)
        .first()
    )
    if skill_result is None:
        raise HttpError(404, "Not found.")
    return skill_result


def _get_review_item_or_404(project_id: int, review_item_id: int) -> ReviewQueue:
    """Return one project-scoped review item or raise 404."""

    review_item = (
        ReviewQueue.objects.select_related("content", "project")
        .filter(project_id=project_id, pk=review_item_id)
        .first()
    )
    if review_item is None:
        raise HttpError(404, "Not found.")
    return review_item


def _serialize_skill_result(skill_result: SkillResult) -> dict[str, Any]:
    """Return one serialized skill result payload."""

    return {
        "id": _require_pk(skill_result),
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


def _serialize_review_item(review_item: ReviewQueue) -> dict[str, Any]:
    """Return one serialized review-queue payload."""

    return {
        "id": _require_pk(review_item),
        "project": review_item.project_id,
        "content": review_item.content_id,
        "reason": review_item.reason,
        "confidence": review_item.confidence,
        "failed_node": review_item.failed_node,
        "failure_detail": review_item.failure_detail,
        "skill_invocation_id": (
            str(review_item.skill_invocation_id)
            if review_item.skill_invocation_id is not None
            else None
        ),
        "created_at": review_item.created_at,
        "resolved": review_item.resolved,
        "resolved_at": review_item.resolved_at,
        "resolution": review_item.resolution,
    }


def _project_content_or_error(project: Project, content_id: int):
    """Return one project-owned content row or a validation payload."""

    content = Content.objects.filter(pk=content_id).first()
    if content is None or content.project_id != _require_pk(project):
        return None, {"content": ["Content must belong to the selected project."]}
    return content, None


def _project_skill_result_reference_or_error(project: Project, skill_result_id: int):
    """Return one project-owned superseded-by target or a validation payload."""

    skill_result = SkillResult.objects.filter(pk=skill_result_id).first()
    if skill_result is None or skill_result.project_id != _require_pk(project):
        return None, {
            "superseded_by": [
                "Superseded skill result must belong to the selected project."
            ]
        }
    return skill_result, None


def _validate_skill_status(status_value: str):
    """Return a validation payload when the supplied skill status is invalid."""

    valid_statuses = {
        choice for choice, _ in SkillResult._meta.get_field("status").choices
    }
    if status_value not in valid_statuses:
        return {"status": ["Select a valid choice."]}
    return None


def _validate_review_reason(reason: str):
    """Return a validation payload when the supplied review reason is invalid."""

    valid_reasons = {
        choice for choice, _ in ReviewQueue._meta.get_field("reason").choices
    }
    if reason not in valid_reasons:
        return {"reason": ["Select a valid choice."]}
    return None


def _validate_review_resolution(resolution: str):
    """Return a validation payload when the supplied review resolution is invalid."""

    if resolution == "":
        return None
    valid_resolutions = {
        choice for choice, _ in ReviewQueue._meta.get_field("resolution").choices
    }
    if resolution not in valid_resolutions:
        return {"resolution": ["Select a valid choice."]}
    return None


@router.get(
    "/skill-results/",
    response=list[SkillResultSchema],
    auth=drf_authenticate,
)
def list_skill_results(request: Any, project_id: int = Path(...)):
    """Return persisted pipeline skill results for one project."""

    _require_project_member(request, project_id)
    skill_results = SkillResult.objects.select_related(
        "content", "project", "superseded_by"
    ).filter(project_id=project_id)
    return [_serialize_skill_result(skill_result) for skill_result in skill_results]


@router.post(
    "/skill-results/",
    response={201: SkillResultSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def create_skill_result(
    request: Any,
    payload: SkillResultCreateInput,
    project_id: int = Path(...),
):
    """Create one skill result under the selected project."""

    project = _require_project_contributor(request, project_id)
    content, content_error = _project_content_or_error(project, payload.content)
    if content_error is not None:
        return Status(400, content_error)
    status_error = _validate_skill_status(payload.status)
    if status_error is not None:
        return Status(400, status_error)

    superseded_by = None
    if payload.superseded_by is not None:
        superseded_by, superseded_error = _project_skill_result_reference_or_error(
            project,
            payload.superseded_by,
        )
        if superseded_error is not None:
            return Status(400, superseded_error)

    skill_result = SkillResult.objects.create(
        project=project,
        content=content,
        skill_name=payload.skill_name,
        status=payload.status,
        result_data=payload.result_data,
        error_message=payload.error_message,
        model_used=payload.model_used,
        latency_ms=payload.latency_ms,
        confidence=payload.confidence,
        superseded_by=superseded_by,
    )
    return Status(201, _serialize_skill_result(skill_result))


@router.get(
    "/skill-results/{skill_result_id}/",
    response=SkillResultSchema,
    auth=drf_authenticate,
)
def get_skill_result(
    request: Any,
    project_id: int = Path(...),
    skill_result_id: int = Path(...),
):
    """Return one persisted skill result."""

    _require_project_member(request, project_id)
    return _serialize_skill_result(
        _get_skill_result_or_404(project_id, skill_result_id)
    )


@router.patch(
    "/skill-results/{skill_result_id}/",
    response={200: SkillResultSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def update_skill_result(
    request: Any,
    payload: SkillResultUpdateInput,
    project_id: int = Path(...),
    skill_result_id: int = Path(...),
):
    """Partially update one persisted skill result."""

    project = _require_project_contributor(request, project_id)
    skill_result = _get_skill_result_or_404(project_id, skill_result_id)
    updates = payload.model_dump(exclude_unset=True)

    if "content" in updates:
        content, content_error = _project_content_or_error(project, updates["content"])
        if content_error is not None:
            return Status(400, content_error)
        skill_result.content = content
    if "status" in updates:
        status_error = _validate_skill_status(updates["status"])
        if status_error is not None:
            return Status(400, status_error)
        skill_result.status = updates["status"]
    if "skill_name" in updates:
        skill_result.skill_name = updates["skill_name"]
    if "result_data" in updates:
        skill_result.result_data = updates["result_data"]
    if "error_message" in updates:
        skill_result.error_message = updates["error_message"]
    if "model_used" in updates:
        skill_result.model_used = updates["model_used"]
    if "latency_ms" in updates:
        skill_result.latency_ms = updates["latency_ms"]
    if "confidence" in updates:
        skill_result.confidence = updates["confidence"]
    if "superseded_by" in updates:
        superseded_by_id = updates["superseded_by"]
        if superseded_by_id is None:
            skill_result.superseded_by = None
        else:
            superseded_by, superseded_error = _project_skill_result_reference_or_error(
                project,
                superseded_by_id,
            )
            if superseded_error is not None:
                return Status(400, superseded_error)
            skill_result.superseded_by = superseded_by

    skill_result.save()
    return _serialize_skill_result(skill_result)


@router.delete(
    "/skill-results/{skill_result_id}/",
    response={204: None},
    auth=drf_authenticate,
)
def delete_skill_result(
    request: Any,
    project_id: int = Path(...),
    skill_result_id: int = Path(...),
):
    """Delete one persisted skill result."""

    _require_project_contributor(request, project_id)
    skill_result = _get_skill_result_or_404(project_id, skill_result_id)
    skill_result.delete()
    return Status(204)


@router.get(
    "/review-queue/",
    response=list[ReviewQueueItemSchema],
    auth=drf_authenticate,
)
def list_review_queue_items(request: Any, project_id: int = Path(...)):
    """Return review-queue items for one project."""

    _require_project_contributor(request, project_id)
    review_items = ReviewQueue.objects.select_related("content", "project").filter(
        project_id=project_id
    )
    return [_serialize_review_item(review_item) for review_item in review_items]


@router.post(
    "/review-queue/",
    response={201: ReviewQueueItemSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def create_review_queue_item(
    request: Any,
    payload: ReviewQueueCreateInput,
    project_id: int = Path(...),
):
    """Create one review-queue item under the selected project."""

    project = _require_project_contributor(request, project_id)
    content, content_error = _project_content_or_error(project, payload.content)
    if content_error is not None:
        return Status(400, content_error)
    reason_error = _validate_review_reason(payload.reason)
    if reason_error is not None:
        return Status(400, reason_error)
    resolution_error = _validate_review_resolution(payload.resolution)
    if resolution_error is not None:
        return Status(400, resolution_error)

    review_item = ReviewQueue.objects.create(
        project=project,
        content=content,
        reason=payload.reason,
        confidence=payload.confidence,
        failed_node=payload.failed_node,
        failure_detail=payload.failure_detail,
        skill_invocation_id=payload.skill_invocation_id,
        resolved=payload.resolved,
        resolved_at=payload.resolved_at,
        resolution=payload.resolution,
    )
    return Status(201, _serialize_review_item(review_item))


@router.get(
    "/review-queue/{review_item_id}/",
    response=ReviewQueueItemSchema,
    auth=drf_authenticate,
)
def get_review_queue_item(
    request: Any,
    project_id: int = Path(...),
    review_item_id: int = Path(...),
):
    """Return one review-queue item."""

    _require_project_contributor(request, project_id)
    return _serialize_review_item(_get_review_item_or_404(project_id, review_item_id))


@router.patch(
    "/review-queue/{review_item_id}/",
    response={200: ReviewQueueItemSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def update_review_queue_item(
    request: Any,
    payload: ReviewQueueUpdateInput,
    project_id: int = Path(...),
    review_item_id: int = Path(...),
):
    """Partially update one review-queue item."""

    project = _require_project_contributor(request, project_id)
    review_item = _get_review_item_or_404(project_id, review_item_id)
    updates = payload.model_dump(exclude_unset=True)

    if "content" in updates:
        content, content_error = _project_content_or_error(project, updates["content"])
        if content_error is not None:
            return Status(400, content_error)
        review_item.content = content
    if "reason" in updates:
        reason_error = _validate_review_reason(updates["reason"])
        if reason_error is not None:
            return Status(400, reason_error)
        review_item.reason = updates["reason"]
    if "confidence" in updates:
        review_item.confidence = updates["confidence"]
    if "failed_node" in updates:
        review_item.failed_node = updates["failed_node"]
    if "failure_detail" in updates:
        review_item.failure_detail = updates["failure_detail"]
    if "skill_invocation_id" in updates:
        review_item.skill_invocation_id = updates["skill_invocation_id"]
    if "resolved" in updates:
        review_item.resolved = updates["resolved"]
    if "resolved_at" in updates:
        review_item.resolved_at = updates["resolved_at"]
    if "resolution" in updates:
        resolution_error = _validate_review_resolution(updates["resolution"])
        if resolution_error is not None:
            return Status(400, resolution_error)
        review_item.resolution = updates["resolution"]

    review_item.save()
    return _serialize_review_item(review_item)


@router.delete(
    "/review-queue/{review_item_id}/",
    response={204: None},
    auth=drf_authenticate,
)
def delete_review_queue_item(
    request: Any,
    project_id: int = Path(...),
    review_item_id: int = Path(...),
):
    """Delete one review-queue item."""

    _require_project_contributor(request, project_id)
    review_item = _get_review_item_or_404(project_id, review_item_id)
    review_item.delete()
    return Status(204)


@router.post(
    "/review-queue/{review_item_id}/retry/",
    response={200: dict[str, Any], 202: ReviewQueueRetryQueuedSchema},
    auth=drf_authenticate,
)
def retry_review_queue_item_route(
    request: Any,
    project_id: int = Path(...),
    review_item_id: int = Path(...),
):
    """Retry one review-queue item from its failed pipeline node."""

    _require_project_contributor(request, project_id)
    review_item = _get_review_item_or_404(project_id, review_item_id)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        return retry_pipeline_review_item(review_item.pk)
    retry_pipeline_review_item.delay(review_item.pk)
    return Status(
        202,
        {
            "review_item_id": _require_pk(review_item),
            "status": "queued",
        },
    )


@router.post(
    "/review-queue/{review_item_id}/resolve/",
    response=ReviewQueueItemSchema,
    auth=drf_authenticate,
)
def resolve_review_queue_item_route(
    request: Any,
    project_id: int = Path(...),
    review_item_id: int = Path(...),
):
    """Resolve one review-queue item without retrying it."""

    _require_project_contributor(request, project_id)
    review_item = _get_review_item_or_404(project_id, review_item_id)
    review_item.resolved = True
    review_item.resolution = ReviewResolution.MANUALLY_RESOLVED
    review_item.resolved_at = timezone.now()
    review_item.save(update_fields=["resolved", "resolution", "resolved_at"])
    return _serialize_review_item(review_item)


@router.post(
    "/review-queue/{review_item_id}/archive/",
    response=ReviewQueueItemSchema,
    auth=drf_authenticate,
)
def archive_review_queue_item_route(
    request: Any,
    project_id: int = Path(...),
    review_item_id: int = Path(...),
):
    """Archive one review-queue item."""

    _require_project_contributor(request, project_id)
    review_item = _get_review_item_or_404(project_id, review_item_id)
    review_item.resolved = True
    review_item.resolution = ReviewResolution.ARCHIVED
    review_item.resolved_at = timezone.now()
    review_item.save(update_fields=["resolved", "resolution", "resolved_at"])
    return _serialize_review_item(review_item)


__all__ = ["router"]
