import datetime
from typing import Any

from ninja import Path, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status

from core.ninja_api import api_authenticate
from projects.models import ProjectMembership, ProjectRole
from projects.ninja_helpers import _require_project_admin

router = Router(tags=["Project Memberships"])


class ProjectMembershipSchema(Schema):
    id: int
    project: int
    user: int
    username: str
    email: str
    display_name: str
    role: str
    invited_by: int | None = None
    joined_at: datetime.datetime | str


class ProjectMembershipUpdateInput(Schema):
    role: str


def _serialize_membership(membership: ProjectMembership) -> dict[str, Any]:
    return {
        "id": int(membership.pk),
        "project": membership.project_id,
        "user": membership.user_id,
        "username": membership.user.username,
        "email": membership.user.email,
        "display_name": membership.user.display_name,
        "role": membership.role,
        "invited_by": membership.invited_by_id,
        "joined_at": membership.joined_at,
    }


def _role_error(message: str) -> dict[str, list[str]]:
    """Return the native Ninja error payload shape for role validation failures."""

    return {"role": [message]}


def _validate_role(role: str) -> dict[str, list[str]] | None:
    """Restrict membership role updates to the supported project roles."""

    if role not in ProjectRole.values:
        return _role_error("Select a valid project role.")
    return None


def _validate_project_keeps_admin(
    membership: ProjectMembership,
    *,
    next_role: str | None = None,
) -> dict[str, list[str]] | None:
    """Reject changes that would leave the project without an admin."""

    resulting_role = next_role
    if membership.role != ProjectRole.ADMIN or resulting_role == ProjectRole.ADMIN:
        return None

    has_other_admin = (
        ProjectMembership.objects.filter(project=membership.project)
        .exclude(pk=membership.pk)
        .filter(role=ProjectRole.ADMIN)
        .exists()
    )
    if not has_other_admin:
        return _role_error("Projects must keep at least one admin.")
    return None


def _get_membership_or_404(project_id: int, membership_id: int) -> ProjectMembership:
    membership = (
        ProjectMembership.objects.select_related("project", "user", "invited_by")
        .filter(project_id=project_id, pk=membership_id)
        .first()
    )
    if not membership:
        raise HttpError(404, "Not found.")
    return membership


@router.get("/", response=list[ProjectMembershipSchema], auth=api_authenticate)
def list_memberships(request, project_id: int = Path(...)):
    _require_project_admin(request, project_id)
    # The original query uses select_related and orders by joined_at, user__username
    memberships = (
        ProjectMembership.objects.select_related("project", "user", "invited_by")
        .filter(project_id=project_id)
        .order_by("joined_at", "user__username")
    )
    return [_serialize_membership(m) for m in memberships]


@router.patch(
    "/{membership_id}/",
    response={200: ProjectMembershipSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_membership(
    request,
    payload: ProjectMembershipUpdateInput,
    project_id: int = Path(...),
    membership_id: int = Path(...),
):
    _require_project_admin(request, project_id)
    membership = _get_membership_or_404(project_id, membership_id)

    role_errors = _validate_role(payload.role)
    if role_errors is not None:
        return Status(400, role_errors)

    admin_errors = _validate_project_keeps_admin(membership, next_role=payload.role)
    if admin_errors is not None:
        return Status(400, admin_errors)

    membership.role = payload.role
    membership.save(update_fields=["role"])
    return _serialize_membership(membership)


@router.delete(
    "/{membership_id}/",
    response={204: None, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def delete_membership(
    request, project_id: int = Path(...), membership_id: int = Path(...)
):
    _require_project_admin(request, project_id)
    membership = _get_membership_or_404(project_id, membership_id)

    admin_errors = _validate_project_keeps_admin(membership, next_role=None)
    if admin_errors is not None:
        return Status(400, admin_errors)

    membership.delete()
    return Status(204, None)
