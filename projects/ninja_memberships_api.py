from typing import Any, cast
import datetime

from ninja import Router, Schema, Path
from ninja.errors import HttpError
from rest_framework import status

from core.ninja_api import drf_authenticate
from projects.models import ProjectMembership
from projects.serializers import ProjectMembershipSerializer
from projects.api import _assert_project_keeps_admin
from projects.ninja_api import _require_project_admin, _get_project_or_404

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
    return cast(dict[str, Any], ProjectMembershipSerializer(membership).data)


def _get_membership_or_404(project_id: int, membership_id: int) -> ProjectMembership:
    membership = (
        ProjectMembership.objects.select_related("project", "user", "invited_by")
        .filter(project_id=project_id, pk=membership_id)
        .first()
    )
    if not membership:
        raise HttpError(404, "Not found.")
    return membership


@router.get("/", response=list[ProjectMembershipSchema], auth=drf_authenticate)
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
    "/{membership_id}/", response=ProjectMembershipSchema, auth=drf_authenticate
)
def update_membership(
    request,
    payload: ProjectMembershipUpdateInput,
    project_id: int = Path(...),
    membership_id: int = Path(...),
):
    _require_project_admin(request, project_id)
    membership = _get_membership_or_404(project_id, membership_id)

    # Check custom constraint
    _assert_project_keeps_admin(membership.project, membership, next_role=payload.role)

    serializer = ProjectMembershipSerializer(
        membership,
        data=payload.model_dump(exclude_unset=True),
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_membership(membership)


@router.delete("/{membership_id}/", response={204: None}, auth=drf_authenticate)
def delete_membership(
    request, project_id: int = Path(...), membership_id: int = Path(...)
):
    _require_project_admin(request, project_id)
    membership = _get_membership_or_404(project_id, membership_id)

    # Check custom constraint
    _assert_project_keeps_admin(membership.project, membership, next_role=None)

    membership.delete()
    return 204, None
