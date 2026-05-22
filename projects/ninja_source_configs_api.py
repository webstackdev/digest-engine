import datetime
from typing import Any

from ninja import Path, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status

from core.ninja_api import api_authenticate
from ingestion.plugins import validate_plugin_config
from projects.ninja_api import _require_project_writable, _get_project_or_404
from projects.models import SourceConfig

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
    return {
        "id": int(config.pk),
        "project": config.project_id,
        "plugin_name": config.plugin_name,
        "config": config.config,
        "is_active": config.is_active,
        "last_fetched_at": config.last_fetched_at,
    }


def _validated_source_config_payload(
    payload: dict[str, Any],
    *,
    instance: SourceConfig | None = None,
) -> dict[str, Any] | None:
    """Validate and normalize one source-config payload.

    Returns a 400 payload shape when plugin validation fails.
    """

    plugin_name = payload.get("plugin_name") or getattr(instance, "plugin_name", None)
    config = payload.get("config")
    if config is None and instance is not None:
        config = instance.config
    if plugin_name:
        try:
            payload["config"] = validate_plugin_config(plugin_name, config or {})
        except ValueError:
            return {"config": ["Invalid source configuration."]}
    return None


def _get_source_config_or_404(project_id: int, config_id: int) -> SourceConfig:
    config = SourceConfig.objects.filter(project_id=project_id, pk=config_id).first()
    if not config:
        raise HttpError(404, "Not found.")
    return config


@router.get("/", response=list[SourceConfigSchema], auth=api_authenticate)
def list_source_configs(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    configs = SourceConfig.objects.select_related("project").filter(
        project_id=project_id
    )
    return [_serialize_config(c) for c in configs]


@router.post(
    "/",
    response={201: SourceConfigSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def create_source_config(
    request, payload: SourceConfigCreateInput, project_id: int = Path(...)
):
    project = _require_project_writable(request, project_id)
    validated_payload = payload.model_dump(exclude_unset=True)
    errors = _validated_source_config_payload(validated_payload)
    if errors is not None:
        return Status(400, errors)
    config = SourceConfig.objects.create(project=project, **validated_payload)
    return Status(201, _serialize_config(config))


@router.get("/{config_id}/", response=SourceConfigSchema, auth=api_authenticate)
def get_source_config(request, project_id: int = Path(...), config_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    config = _get_source_config_or_404(project_id, config_id)
    return _serialize_config(config)


@router.patch(
    "/{config_id}/",
    response={200: SourceConfigSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_source_config(
    request,
    payload: SourceConfigUpdateInput,
    project_id: int = Path(...),
    config_id: int = Path(...),
):
    _require_project_writable(request, project_id)
    config = _get_source_config_or_404(project_id, config_id)
    validated_payload = payload.model_dump(exclude_unset=True)
    errors = _validated_source_config_payload(validated_payload, instance=config)
    if errors is not None:
        return Status(400, errors)
    for field_name, value in validated_payload.items():
        setattr(config, field_name, value)
    config.save()
    return _serialize_config(config)


@router.delete("/{config_id}/", response={204: None}, auth=api_authenticate)
def delete_source_config(
    request, project_id: int = Path(...), config_id: int = Path(...)
):
    _require_project_writable(request, project_id)
    config = _get_source_config_or_404(project_id, config_id)
    config.delete()
    return Status(204, None)
