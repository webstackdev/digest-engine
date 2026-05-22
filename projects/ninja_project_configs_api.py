from __future__ import annotations

from typing import Any

from celery.schedules import crontab
from django.conf import settings
from django.core.exceptions import ValidationError
from ninja import Path, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status

from core.ninja_api import api_authenticate
from projects.models import ProjectConfig
from projects.ninja_api import _get_project_or_404, _require_project_admin

router = Router(tags=["Project Configurations"])


class ProjectConfigSchema(Schema):
    """Serialized project configuration payload."""

    id: int
    project: int
    draft_schedule_cron: str | None = None
    authority_weight_mention: float
    authority_weight_engagement: float
    authority_weight_recency: float
    authority_weight_source_quality: float
    authority_weight_cross_newsletter: float
    authority_weight_feedback: float
    authority_weight_duplicate: float
    upvote_authority_weight: float
    downvote_authority_weight: float
    authority_decay_rate: float


class ProjectConfigCreateInput(Schema):
    draft_schedule_cron: str | None = None
    authority_weight_mention: float | None = None
    authority_weight_engagement: float | None = None
    authority_weight_recency: float | None = None
    authority_weight_source_quality: float | None = None
    authority_weight_cross_newsletter: float | None = None
    authority_weight_feedback: float | None = None
    authority_weight_duplicate: float | None = None
    upvote_authority_weight: float | None = None
    downvote_authority_weight: float | None = None
    authority_decay_rate: float | None = None


class ProjectConfigUpdateInput(ProjectConfigCreateInput):
    pass


class ProjectConfigRecomputeResponse(Schema):
    status: str
    project_id: int
    config_id: int


def _serialize_config(config: ProjectConfig) -> dict[str, Any]:
    return {
        "id": int(config.pk),
        "project": config.project_id,
        "draft_schedule_cron": config.draft_schedule_cron,
        "authority_weight_mention": config.authority_weight_mention,
        "authority_weight_engagement": config.authority_weight_engagement,
        "authority_weight_recency": config.authority_weight_recency,
        "authority_weight_source_quality": config.authority_weight_source_quality,
        "authority_weight_cross_newsletter": config.authority_weight_cross_newsletter,
        "authority_weight_feedback": config.authority_weight_feedback,
        "authority_weight_duplicate": config.authority_weight_duplicate,
        "upvote_authority_weight": config.upvote_authority_weight,
        "downvote_authority_weight": config.downvote_authority_weight,
        "authority_decay_rate": config.authority_decay_rate,
    }


def _validation_error_payload(exc: ValidationError) -> dict[str, list[str]]:
    """Convert a Django validation error into the Ninja error payload shape."""

    if hasattr(exc, "message_dict"):
        return {
            field: [str(message) for message in messages]
            for field, messages in exc.message_dict.items()
        }
    return {"__all__": [str(message) for message in exc.messages]}


def _validated_project_config_payload(
    payload: dict[str, Any],
    *,
    project_id: int,
    instance: ProjectConfig | None = None,
) -> dict[str, list[str]] | None:
    """Normalize and validate one project-config payload."""

    if "draft_schedule_cron" in payload and payload["draft_schedule_cron"] is not None:
        normalized = " ".join(str(payload["draft_schedule_cron"]).split())
        if normalized:
            try:
                crontab.from_string(normalized)
            except Exception:
                return {
                    "draft_schedule_cron": ["Enter a valid 5-part cron expression."]
                }
        payload["draft_schedule_cron"] = normalized

    config = instance or ProjectConfig(project_id=project_id)
    for field_name, value in payload.items():
        setattr(config, field_name, value)
    try:
        config.full_clean()
    except ValidationError as exc:
        return _validation_error_payload(exc)
    return None


def _get_config_or_404(project_id: int, config_id: int) -> ProjectConfig:
    config = ProjectConfig.objects.filter(project_id=project_id, pk=config_id).first()
    if not config:
        raise HttpError(404, "Not found.")
    return config


@router.get("/", response=list[ProjectConfigSchema], auth=api_authenticate)
def list_configs(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    configs = ProjectConfig.objects.filter(project_id=project_id).select_related(
        "project"
    )
    return [_serialize_config(c) for c in configs]


@router.post(
    "/",
    response={201: ProjectConfigSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def create_config(
    request, payload: ProjectConfigCreateInput, project_id: int = Path(...)
):
    project = _require_project_admin(request, project_id)
    validated_payload = payload.model_dump(exclude_unset=True)
    errors = _validated_project_config_payload(
        validated_payload,
        project_id=project.id,
    )
    if errors is not None:
        return Status(400, errors)
    config = ProjectConfig.objects.create(project=project, **validated_payload)
    return Status(201, _serialize_config(config))


@router.get("/{config_id}/", response=ProjectConfigSchema, auth=api_authenticate)
def get_config(request, project_id: int = Path(...), config_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    config = _get_config_or_404(project_id, config_id)
    return _serialize_config(config)


@router.patch(
    "/{config_id}/",
    response={200: ProjectConfigSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_config(
    request,
    payload: ProjectConfigUpdateInput,
    project_id: int = Path(...),
    config_id: int = Path(...),
):
    _require_project_admin(request, project_id)
    config = _get_config_or_404(project_id, config_id)
    validated_payload = payload.model_dump(exclude_unset=True)
    errors = _validated_project_config_payload(
        validated_payload,
        project_id=project_id,
        instance=config,
    )
    if errors is not None:
        return Status(400, errors)
    for field_name, value in validated_payload.items():
        setattr(config, field_name, value)
    config.save()
    return _serialize_config(config)


@router.delete("/{config_id}/", response={204: None}, auth=api_authenticate)
def delete_config(request, project_id: int = Path(...), config_id: int = Path(...)):
    _require_project_admin(request, project_id)
    config = _get_config_or_404(project_id, config_id)
    config.delete()
    return Status(204, None)


@router.post(
    "/{config_id}/recompute_authority/",
    response={200: ProjectConfigRecomputeResponse, 202: ProjectConfigRecomputeResponse},
    auth=api_authenticate,
)
def recompute_authority(
    request, project_id: int = Path(...), config_id: int = Path(...)
):
    # This requires admin in DRF
    _require_project_admin(request, project_id)
    config = _get_config_or_404(project_id, config_id)

    from core.tasks import recompute_authority_scores, recompute_source_quality

    payload = {
        "status": "queued",
        "project_id": project_id,
        "config_id": config.pk,
    }

    if settings.CELERY_TASK_ALWAYS_EAGER:
        recompute_source_quality(project_id)
        recompute_authority_scores(project_id)
        payload["status"] = "completed"
        return Status(200, payload)

    recompute_source_quality.delay(project_id)
    recompute_authority_scores.delay(project_id)
    return Status(202, payload)
