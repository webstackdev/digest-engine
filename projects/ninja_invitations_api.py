import datetime
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils import timezone
from ninja import Path, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status

from core.ninja_api import drf_authenticate
from projects.ninja_api import _require_project_admin
from projects.models import ProjectRole
from users.models import MembershipInvitation

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
    return {
        "id": int(invitation.pk),
        "project": project.id,
        "email": invitation.email,
        "role": invitation.role,
        "token": invitation.token,
        "invited_by": invitation.invited_by_id,
        "invited_by_email": (
            invitation.invited_by.email if invitation.invited_by else ""
        ),
        "invite_url": f"{settings.FRONTEND_BASE_URL.rstrip('/')}/invite/{invitation.token}",
        "created_at": invitation.created_at,
        "accepted_at": invitation.accepted_at,
        "revoked_at": invitation.revoked_at,
    }


def _error_payload(field: str, message: str) -> dict[str, list[str]]:
    """Return the native Ninja validation payload shape."""

    return {field: [message]}


def _validation_error_payload(exc: ValidationError) -> dict[str, list[str]]:
    """Convert a Django validation error into the Ninja error payload shape."""

    if hasattr(exc, "message_dict"):
        return {
            field: [str(message) for message in messages]
            for field, messages in exc.message_dict.items()
        }
    return {"__all__": [str(message) for message in exc.messages]}


def _validated_invitation_payload(
    payload: dict[str, Any],
    *,
    project,
) -> tuple[dict[str, Any], dict[str, list[str]] | None]:
    """Normalize and validate an invitation payload for one project."""

    normalized_payload = dict(payload)
    normalized_payload["email"] = (
        str(normalized_payload.get("email", "")).strip().lower()
    )

    if normalized_payload.get("role") not in ProjectRole.values:
        return normalized_payload, _error_payload(
            "role", "Select a valid project role."
        )

    invitation = MembershipInvitation(project=project, **normalized_payload)
    try:
        invitation.full_clean(
            exclude=["token", "invited_by", "accepted_at", "revoked_at"]
        )
    except ValidationError as exc:
        return normalized_payload, _validation_error_payload(exc)

    email = normalized_payload["email"]
    if project.memberships.filter(user__email__iexact=email).exists():
        return normalized_payload, _error_payload(
            "email", "That user is already a project member."
        )

    active_invitation_exists = MembershipInvitation.objects.filter(
        project=project,
        email__iexact=email,
        accepted_at__isnull=True,
        revoked_at__isnull=True,
    ).exists()
    if active_invitation_exists:
        return normalized_payload, _error_payload(
            "email", "An active invitation already exists for this email."
        )

    return normalized_payload, None


def _send_membership_invitation_email(invitation: MembershipInvitation) -> None:
    """Send the one-time membership invitation email."""

    invite_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/invite/{invitation.token}"
    send_mail(
        subject=f"You're invited to join {invitation.project.name}",
        message=(
            f"You have been invited to join {invitation.project.name} as a "
            f"{invitation.role}.\n\nOpen this link to accept the invitation:\n{invite_url}"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        fail_silently=False,
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


@router.post(
    "/",
    response={201: MembershipInvitationSchema, 400: dict[str, list[str]]},
    auth=drf_authenticate,
)
def create_invitation(
    request, payload: MembershipInvitationCreateInput, project_id: int = Path(...)
):
    project = _require_project_admin(request, project_id)

    validated_payload, errors = _validated_invitation_payload(
        payload.model_dump(exclude_unset=True),
        project=project,
    )
    if errors is not None:
        return Status(400, errors)

    invitation = MembershipInvitation.objects.create(
        project=project,
        invited_by=request.user,
        **validated_payload,
    )
    _send_membership_invitation_email(invitation)

    return Status(201, _serialize_invitation(invitation, project))


@router.delete("/{invitation_id}/", response={204: None}, auth=drf_authenticate)
def revoke_invitation(
    request, project_id: int = Path(...), invitation_id: int = Path(...)
):
    _require_project_admin(request, project_id)
    invitation = _get_invitation_or_404(project_id, invitation_id)

    invitation.revoked_at = timezone.now()
    invitation.save(update_fields=["revoked_at"])
    return Status(204, None)
