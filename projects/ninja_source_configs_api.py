from typing import Any, cast
import datetime

from ninja import Router, Schema, Path
from ninja.errors import HttpError
from rest_framework import status

from core.ninja_api import drf_authenticate
from projects.ninja_api import _require_project_writable, _get_project_or_404
from projects.models import SourceConfig
from projects.serializers import SourceConfigSerializer

router = Router(tags=["Source Configurations"])


class SourceConfigSchema(Schema):
    id: int
    project: int
    plugin_name: str
    config: dict[str, Any]
    is_active: bool
    last_fetched_at: datetime.datetime | str | None = None


class SourceConfigCreateInput(Schema):
    plugin_name: str
    config: dict[str, Any] | None = None
    is_active: bool | None = None


class SourceConfigUpdateInput(Schema):
    plugin_name: str | None = None
    config: dict[str, Any] | None = None
    is_active: bool | None = None


def _serialize_config(config: SourceConfig) -> dict[str, Any]:
    return cast(dict[str, Any], SourceConfigSerializer(config).data)


def _get_source_config_or_404(project_id: int, config_id: int) -> SourceConfig:
    config = SourceConfig.objects.filter(project_id=project_id, pk=config_id).first()
    if not config:
        raise HttpError(404, "Not found.")
    return config


@router.get("/", response=list[SourceConfigSchema], auth=drf_authenticate)
def list_source_configs(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    configs = SourceConfig.objects.select_related("project").filter(
        project_id=project_id
    )
    return [_serialize_config(c) for c in configs]


@router.post("/", response={201: SourceConfigSchema}, auth=drf_authenticate)
def create_source_config(
    request, payload: SourceConfigCreateInput, project_id: int = Path(...)
):
    project = _require_project_writable(request, project_id)
    serializer = SourceConfigSerializer(
        data=payload.model_dump(exclude_unset=True), context={"project": project}
    )
    serializer.is_valid(raise_exception=True)
    config = serializer.save(project=project)
    return 201, _serialize_config(config)


@router.get("/{config_id}/", response=SourceConfigSchema, auth=drf_authenticate)
def get_source_config(request, project_id: int = Path(...), config_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    config = _get_source_config_or_404(project_id, config_id)
    return _serialize_config(config)


@router.patch("/{config_id}/", response=SourceConfigSchema, auth=drf_authenticate)
def update_source_config(
    request,
    payload: SourceConfigUpdateInput,
    project_id: int = Path(...),
    config_id: int = Path(...),
):
    _require_project_writable(request, project_id)
    config = _get_source_config_or_404(project_id, config_id)
    serializer = SourceConfigSerializer(
        config,
        data=payload.model_dump(exclude_unset=True),
        partial=True,
        context={"project": config.project},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_config(config)


@router.delete("/{config_id}/", response={204: None}, auth=drf_authenticate)
def delete_source_config(
    request, project_id: int = Path(...), config_id: int = Path(...)
):
    _require_project_writable(request, project_id)
    config = _get_source_config_or_404(project_id, config_id)
    config.delete()
    return 204, None
