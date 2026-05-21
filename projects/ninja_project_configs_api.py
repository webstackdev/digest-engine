from __future__ import annotations

import datetime
from typing import Any, cast

from django.conf import settings
from ninja import Router, Schema, Path
from ninja.errors import HttpError
from rest_framework import status

from core.ninja_api import drf_authenticate
from projects.models import ProjectConfig
from projects.ninja_api import _get_project_or_404, _require_project_admin
from projects.serializers import ProjectConfigSerializer

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
    return cast(dict[str, Any], ProjectConfigSerializer(config).data)

def _get_config_or_404(project_id: int, config_id: int) -> ProjectConfig:
    config = ProjectConfig.objects.filter(project_id=project_id, pk=config_id).first()
    if not config:
        raise HttpError(404, "Not found.")
    return config

@router.get("/", response=list[ProjectConfigSchema], auth=drf_authenticate)
def list_configs(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    configs = ProjectConfig.objects.filter(project_id=project_id).select_related("project")
    return [_serialize_config(c) for c in configs]

@router.post("/", response={201: ProjectConfigSchema}, auth=drf_authenticate)
def create_config(request, payload: ProjectConfigCreateInput, project_id: int = Path(...)):
    project = _require_project_admin(request, project_id)
    serializer = ProjectConfigSerializer(data=payload.model_dump(exclude_unset=True))
    serializer.is_valid(raise_exception=True)
    config = serializer.save(project=project)
    return 201, _serialize_config(config)

@router.get("/{config_id}/", response=ProjectConfigSchema, auth=drf_authenticate)
def get_config(request, project_id: int = Path(...), config_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    config = _get_config_or_404(project_id, config_id)
    return _serialize_config(config)

@router.patch("/{config_id}/", response=ProjectConfigSchema, auth=drf_authenticate)
def update_config(request, payload: ProjectConfigUpdateInput, project_id: int = Path(...), config_id: int = Path(...)):
    _require_project_admin(request, project_id)
    config = _get_config_or_404(project_id, config_id)
    serializer = ProjectConfigSerializer(
        config,
        data=payload.model_dump(exclude_unset=True),
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_config(config)

@router.delete("/{config_id}/", response={204: None}, auth=drf_authenticate)
def delete_config(request, project_id: int = Path(...), config_id: int = Path(...)):
    _require_project_admin(request, project_id)
    config = _get_config_or_404(project_id, config_id)
    config.delete()
    return 204, None

@router.post(
    "/{config_id}/recompute_authority/",
    response={200: ProjectConfigRecomputeResponse, 202: ProjectConfigRecomputeResponse},
    auth=drf_authenticate,
)
def recompute_authority(request, project_id: int = Path(...), config_id: int = Path(...)):
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
        return 200, payload

    recompute_source_quality.delay(project_id)
    recompute_authority_scores.delay(project_id)
    return 202, payload

