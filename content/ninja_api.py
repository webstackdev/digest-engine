"""Django Ninja endpoints for project-scoped content resources."""

from __future__ import annotations

import datetime
from typing import Any, cast

from ninja import Path, Router, Schema
from ninja.errors import HttpError
from rest_framework import serializers

from content.api import (
    CLASSIFICATION_SKILL_NAME,
    RELATED_CONTENT_SKILL_NAME,
    RELEVANCE_SKILL_NAME,
    SUMMARIZATION_SKILL_NAME,
)
from content.models import Content, UserFeedback
from content.serializers import ContentSerializer, UserFeedbackSerializer
from core.ninja_api import drf_authenticate
from pipeline.serializers import SkillResultSerializer
from projects.models import ProjectMembership, ProjectRole
from projects.ninja_api import (
    _get_project_or_404,
    _require_project_admin,
    _require_project_writable,
)

content_router = Router(tags=["Content Library"])
feedback_router = Router(tags=["Feedback"])

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

    return cast(dict[str, Any], ContentSerializer(content).data)


def _serialize_skill_result(skill_result: Any) -> dict[str, Any]:
    """Return one persisted skill result response body."""

    return cast(dict[str, Any], SkillResultSerializer(skill_result).data)


def _serialize_feedback(feedback: UserFeedback) -> dict[str, Any]:
    """Return one feedback response body."""

    return cast(dict[str, Any], UserFeedbackSerializer(feedback).data)


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


@content_router.post("/", response={201: ContentSchema}, auth=drf_authenticate)
def create_content(
    request: Any,
    payload: ContentCreateInput,
    project_id: int = Path(...),
):
    """Create one content row under the selected project."""

    project = _require_project_writable(request, project_id)
    serializer = ContentSerializer(
        data=payload.model_dump(exclude_unset=True, exclude_none=False),
        context={"project": project},
    )
    serializer.is_valid(raise_exception=True)
    content = serializer.save(project=project)
    return 201, _serialize_content(content)


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
    response=ContentSchema,
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
    serializer = ContentSerializer(
        content,
        data=payload.model_dump(exclude_unset=True, exclude_none=False),
        partial=True,
        context={"project": content.project},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
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
    return 204, None


@content_router.post(
    "/{content_id}/skills/{skill_name}/",
    response={201: SkillResultSchema, 202: SkillResultSchema},
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
        raise serializers.ValidationError(
            {
                "skill_name": (
                    "Unsupported skill. Choose one of: content_classification, relevance_scoring, "
                    "summarization, find_related."
                )
            }
        )

    content = _get_content_or_404(project_id, content_id)
    if skill_name in QUEUED_SKILL_NAMES:
        from core.tasks import queue_content_skill

        skill_result = queue_content_skill(content, skill_name)
        return 202, _serialize_skill_result(skill_result)

    from core.pipeline import execute_ad_hoc_skill

    skill_result = execute_ad_hoc_skill(content, skill_name)
    return 201, _serialize_skill_result(skill_result)


@feedback_router.get("/", response=list[UserFeedbackSchema], auth=drf_authenticate)
def list_feedback(request: Any, project_id: int = Path(...)):
    """List feedback rows visible to the current project member."""

    _get_project_or_404(request, project_id)
    feedback_rows = UserFeedback.objects.select_related(
        "content", "project", "user"
    ).filter(project_id=project_id)
    return [_serialize_feedback(feedback) for feedback in feedback_rows]


@feedback_router.post("/", response={201: UserFeedbackSchema}, auth=drf_authenticate)
def create_feedback(
    request: Any,
    payload: UserFeedbackCreateInput,
    project_id: int = Path(...),
):
    """Create one feedback row and attach the authenticated user."""

    project = _require_project_writable(request, project_id)
    serializer = UserFeedbackSerializer(
        data=payload.model_dump(exclude_unset=True),
        context={"project": project},
    )
    serializer.is_valid(raise_exception=True)
    feedback = serializer.save(project=project, user=request.user)
    return 201, _serialize_feedback(feedback)


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
    response=UserFeedbackSchema,
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
    serializer = UserFeedbackSerializer(
        feedback,
        data=payload.model_dump(exclude_unset=True),
        partial=True,
        context={"project": feedback.project},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
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
    return 204, None


__all__ = ["content_router", "feedback_router"]
