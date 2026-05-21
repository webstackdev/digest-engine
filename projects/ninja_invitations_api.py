from typing import Any, cast
import datetime

from django.utils import timezone
from ninja import Router, Schema, Path
from ninja.errors import HttpError

from core.ninja_api import drf_authenticate
from projects.ninja_api import _require_project_admin
from users.models import MembershipInvitation
from users.serializers import MembershipInvitationSerializer
from projects.api import _send_membership_invitation_email

router = Router(tags=["Project Invitations"])


class MembershipInvitationSchema(Schema):
    id: int
    project: int
    email: str
    role: str
    token: str
    invited_by: int | None = None
    invited_by_email: str
    invite_url: str
    created_at: datetime.datetime | str
    accepted_at: datetime.datetime | str | None = None
    revoked_at: datetime.datetime | str | None = None


class MembershipInvitationCreateInput(Schema):
    email: str
    role: str


def _serialize_invitation(invitation: MembershipInvitation, project) -> dict[str, Any]:
    return cast(
        dict[str, Any],
        MembershipInvitationSerializer(invitation, context={"project": project}).data,
    )


def _get_invitation_or_404(project_id: int, invitation_id: int) -> MembershipInvitation:
    invitation = MembershipInvitation.objects.filter(
        project_id=project_id, pk=invitation_id
    ).first()
    if not invitation:
        raise HttpError(404, "Not found.")
    return invitation


@router.get("/", response=list[MembershipInvitationSchema], auth=drf_authenticate)
def list_invitations(request, project_id: int = Path(...)):
    project = _require_project_admin(request, project_id)
    invitations = (
        MembershipInvitation.objects.select_related("project", "invited_by")
        .filter(project_id=project_id)
        .order_by("-created_at")
    )
    return [_serialize_invitation(inv, project) for inv in invitations]


@router.post("/", response={201: MembershipInvitationSchema}, auth=drf_authenticate)
def create_invitation(
    request, payload: MembershipInvitationCreateInput, project_id: int = Path(...)
):
    project = _require_project_admin(request, project_id)

    serializer = MembershipInvitationSerializer(
        data=payload.model_dump(exclude_unset=True), context={"project": project}
    )
    serializer.is_valid(raise_exception=True)
    invitation = serializer.save(project=project, invited_by=request.user)
    _send_membership_invitation_email(invitation)

    return 201, _serialize_invitation(invitation, project)


@router.delete("/{invitation_id}/", response={204: None}, auth=drf_authenticate)
def revoke_invitation(
    request, project_id: int = Path(...), invitation_id: int = Path(...)
):
    _require_project_admin(request, project_id)
    invitation = _get_invitation_or_404(project_id, invitation_id)

    invitation.revoked_at = timezone.now()
    invitation.save(update_fields=["revoked_at"])
    return 204, None
