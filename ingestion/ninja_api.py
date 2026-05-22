"""Django Ninja endpoints for project-scoped ingestion resources."""

from __future__ import annotations

import datetime
from typing import Any

from django.core.exceptions import ValidationError
from ninja import Path, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status

from core.ninja_api import api_authenticate
from ingestion.models import IngestionRun
from projects.ninja_api import _get_project_or_404, _require_project_writable

router = Router(tags=["Ingestion"])


class IngestionRunSchema(Schema):
    """Serialized ingestion-run payload."""

    id: int
    project: int
    plugin_name: str
    started_at: datetime.datetime
    completed_at: datetime.datetime | None = None
    status: str
    items_fetched: int
    items_ingested: int
    error_message: str


class IngestionRunCreateInput(Schema):
    """Writable ingestion-run fields for create requests."""

    plugin_name: str
    completed_at: datetime.datetime | None = None
    status: str
    items_fetched: int = 0
    items_ingested: int = 0
    error_message: str = ""
    project: int | None = None


class IngestionRunUpdateInput(Schema):
    """Writable ingestion-run fields for update requests."""

    plugin_name: str | None = None
    completed_at: datetime.datetime | None = None
    status: str | None = None
    items_fetched: int | None = None
    items_ingested: int | None = None
    error_message: str | None = None
    project: int | None = None


def _serialize_ingestion_run(ingestion_run: IngestionRun) -> dict[str, Any]:
    """Return one ingestion-run response body."""

    return {
        "id": int(ingestion_run.pk),
        "project": ingestion_run.project_id,
        "plugin_name": ingestion_run.plugin_name,
        "started_at": ingestion_run.started_at,
        "completed_at": ingestion_run.completed_at,
        "status": ingestion_run.status,
        "items_fetched": ingestion_run.items_fetched,
        "items_ingested": ingestion_run.items_ingested,
        "error_message": ingestion_run.error_message,
    }


def _validation_error_payload(exc: ValidationError) -> dict[str, list[str]]:
    """Convert a Django validation error into the Ninja error payload shape."""

    if hasattr(exc, "message_dict"):
        return {
            field: [str(message) for message in messages]
            for field, messages in exc.message_dict.items()
        }
    return {"__all__": [str(message) for message in exc.messages]}


def _validated_ingestion_run_payload(
    payload: dict[str, Any],
    *,
    project,
    instance: IngestionRun | None = None,
) -> tuple[dict[str, Any], dict[str, list[str]] | None]:
    """Normalize and validate one ingestion-run payload."""

    validated_payload = dict(payload)
    validated_payload.pop("project", None)

    ingestion_run = instance or IngestionRun(project=project)
    for field_name, value in validated_payload.items():
        setattr(ingestion_run, field_name, value)
    ingestion_run.project = project
    try:
        ingestion_run.full_clean()
    except ValidationError as exc:
        return validated_payload, _validation_error_payload(exc)
    return validated_payload, None


def _get_ingestion_run_or_404(project_id: int, run_id: int) -> IngestionRun:
    """Load one ingestion run for the selected project."""

    ingestion_run = IngestionRun.objects.filter(
        project_id=project_id, pk=run_id
    ).first()
    if not ingestion_run:
        raise HttpError(404, "Not found.")
    return ingestion_run


@router.get("/", response=list[IngestionRunSchema], auth=api_authenticate)
def list_ingestion_runs(request: Any, project_id: int = Path(...)):
    """List ingestion runs visible to the current project member."""

    _get_project_or_404(request, project_id)
    ingestion_runs = IngestionRun.objects.select_related("project").filter(
        project_id=project_id
    )
    return [_serialize_ingestion_run(ingestion_run) for ingestion_run in ingestion_runs]


@router.post(
    "/",
    response={201: IngestionRunSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def create_ingestion_run(
    request: Any,
    payload: IngestionRunCreateInput,
    project_id: int = Path(...),
):
    """Create one ingestion run under the selected project."""

    project = _require_project_writable(request, project_id)
    validated_payload, errors = _validated_ingestion_run_payload(
        payload.model_dump(exclude_unset=True, exclude_none=False),
        project=project,
    )
    if errors is not None:
        return Status(400, errors)
    ingestion_run = IngestionRun.objects.create(project=project, **validated_payload)
    return Status(201, _serialize_ingestion_run(ingestion_run))


@router.get("/{run_id}/", response=IngestionRunSchema, auth=api_authenticate)
def get_ingestion_run(
    request: Any,
    project_id: int = Path(...),
    run_id: int = Path(...),
):
    """Return one ingestion run."""

    _get_project_or_404(request, project_id)
    return _serialize_ingestion_run(_get_ingestion_run_or_404(project_id, run_id))


@router.patch(
    "/{run_id}/",
    response={200: IngestionRunSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_ingestion_run(
    request: Any,
    payload: IngestionRunUpdateInput,
    project_id: int = Path(...),
    run_id: int = Path(...),
):
    """Update one ingestion run."""

    _require_project_writable(request, project_id)
    ingestion_run = _get_ingestion_run_or_404(project_id, run_id)
    validated_payload, errors = _validated_ingestion_run_payload(
        payload.model_dump(exclude_unset=True, exclude_none=False),
        project=ingestion_run.project,
        instance=ingestion_run,
    )
    if errors is not None:
        return Status(400, errors)
    for field_name, value in validated_payload.items():
        setattr(ingestion_run, field_name, value)
    ingestion_run.save()
    return _serialize_ingestion_run(ingestion_run)


@router.delete("/{run_id}/", response={204: None}, auth=api_authenticate)
def delete_ingestion_run(
    request: Any,
    project_id: int = Path(...),
    run_id: int = Path(...),
):
    """Delete one ingestion run."""

    _require_project_writable(request, project_id)
    ingestion_run = _get_ingestion_run_or_404(project_id, run_id)
    ingestion_run.delete()
    return Status(204, None)


__all__ = ["router"]
