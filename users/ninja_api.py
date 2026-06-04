"""Django Ninja endpoints for the first increment of the users API migration."""

from __future__ import annotations

from typing import Any, cast

from django.core.exceptions import ValidationError
from django.utils import timezone
from ninja import File, Router, Schema
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.responses import Status

from core.ninja_api import api_authenticate
from digest_engine.taskiq import enqueue_task, run_task_inline, task_always_eager
from projects.models import ProjectMembership
from users.models import (
    AVATAR_ALLOWED_CONTENT_TYPES,
    AVATAR_MAX_FILE_SIZE,
    AppUser,
    MembershipInvitation,
    avatar_thumbnail_path,
)
from users.tasks import generate_avatar_thumbnail

router = Router(tags=["Users"])


class UserProfileSchema(Schema):
    """Serialized current-user profile payload."""

    id: int
    username: str
    email: str
    display_name: str | None = None
    avatar: str | None = None
    avatar_url: str | None = None
    avatar_thumbnail_url: str | None = None
    bio: str | None = None
    timezone: str | None = None
    first_name: str | None = None
    last_name: str | None = None


class ProfileUpdateInput(Schema):
    """Editable fields accepted by the profile patch endpoint."""

    display_name: str | None = None
    bio: str | None = None
    timezone: str | None = None


class PublicMembershipInvitationSchema(Schema):
    """Public invitation payload served by the invite token endpoint."""

    token: str
    project_id: int
    project_name: str
    email: str
    role: str
    status: str
    accepted_at: str | None = None
    revoked_at: str | None = None


def _serialize_profile(user: AppUser) -> dict[str, Any]:
    """Return the profile response body for one user."""

    return {
        "id": int(user.pk),
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "avatar": user.avatar_url,
        "avatar_url": user.avatar_url,
        "avatar_thumbnail_url": user.avatar_thumbnail_url,
        "bio": user.bio,
        "timezone": user.timezone,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


def _serialize_public_invitation(invitation: MembershipInvitation) -> dict[str, Any]:
    """Return the public invitation response body for one token."""

    return {
        "token": invitation.token,
        "project_id": invitation.project_id,
        "project_name": invitation.project.name,
        "email": invitation.email,
        "role": invitation.role,
        "status": _invitation_status(invitation),
        "accepted_at": (
            invitation.accepted_at.isoformat() if invitation.accepted_at else None
        ),
        "revoked_at": (
            invitation.revoked_at.isoformat() if invitation.revoked_at else None
        ),
    }


def _invitation_status(invitation: MembershipInvitation) -> str:
    """Return the simple lifecycle status for one invitation token."""

    if invitation.revoked_at is not None:
        return "revoked"
    if invitation.accepted_at is not None:
        return "accepted"
    return "pending"


def _delete_avatar_assets(user: AppUser) -> None:
    """Delete the user's stored avatar and generated thumbnail files."""

    if user.avatar:
        storage = user.avatar.storage
        avatar_name = user.avatar.name
        thumbnail_name = avatar_thumbnail_path(user)
        if avatar_name and storage.exists(avatar_name):
            storage.delete(avatar_name)
        if storage.exists(thumbnail_name):
            storage.delete(thumbnail_name)


def _validation_error_payload(exc: ValidationError) -> dict[str, list[str]]:
    """Convert a Django validation error into the Ninja error payload shape."""

    if hasattr(exc, "message_dict"):
        return {
            field: [str(message) for message in messages]
            for field, messages in exc.message_dict.items()
        }
    return {"__all__": [str(message) for message in exc.messages]}


def _validated_profile_payload(
    payload: dict[str, Any],
    *,
    user: AppUser,
) -> dict[str, list[str]] | None:
    """Validate one profile update payload against the AppUser model."""

    for field_name, value in payload.items():
        setattr(user, field_name, value)
    try:
        user.full_clean()
    except ValidationError as exc:
        return _validation_error_payload(exc)
    return None


def _validated_avatar_upload(avatar: UploadedFile) -> dict[str, list[str]] | None:
    """Validate one uploaded avatar against the configured content limits."""

    content_type = getattr(avatar, "content_type", "")
    if content_type not in AVATAR_ALLOWED_CONTENT_TYPES:
        return {"avatar": ["Upload a PNG, JPEG, or WebP avatar image."]}
    avatar_size = getattr(avatar, "size", None)
    if avatar_size is None or avatar_size > AVATAR_MAX_FILE_SIZE:
        return {"avatar": ["Avatar images must be 2 MB or smaller."]}
    return None


def _get_invitation_or_404(token: str) -> MembershipInvitation:
    """Load one invitation row by token or raise a Ninja 404."""

    try:
        return MembershipInvitation.objects.select_related("project", "invited_by").get(
            token=token
        )
    except MembershipInvitation.DoesNotExist as exc:
        raise HttpError(404, {"detail": "Not found."}) from exc


@router.get("/profile/", response=UserProfileSchema, auth=api_authenticate)
def get_profile(request):
    """Return the current authenticated user's profile payload."""

    return _serialize_profile(cast(AppUser, request.user))


@router.patch(
    "/profile/",
    response={200: UserProfileSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def patch_profile(request, payload: ProfileUpdateInput):
    """Update the current user's editable profile fields."""

    user = cast(AppUser, request.user)
    updated_fields = list(payload.model_dump(exclude_unset=True).keys())
    errors = _validated_profile_payload(
        payload.model_dump(exclude_unset=True),
        user=user,
    )
    if errors is not None:
        return Status(400, errors)
    if updated_fields:
        user.save(update_fields=updated_fields)
    return _serialize_profile(user)


@router.post(
    "/profile/avatar/",
    response={200: UserProfileSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def upload_profile_avatar(request, avatar: File[UploadedFile]):
    """Store a new avatar image for the current user and queue a thumbnail."""

    errors = _validated_avatar_upload(avatar)
    if errors is not None:
        return Status(400, errors)

    user = cast(AppUser, request.user)
    _delete_avatar_assets(user)
    user.avatar = avatar
    user.save(update_fields=["avatar"])

    if task_always_eager():
        run_task_inline(generate_avatar_thumbnail, user.id)
    else:
        enqueue_task(generate_avatar_thumbnail, user.id)

    return _serialize_profile(user)


@router.delete(
    "/profile/avatar/",
    response=UserProfileSchema,
    auth=api_authenticate,
)
def delete_profile_avatar(request):
    """Remove the current user's avatar image and generated thumbnail."""

    user = cast(AppUser, request.user)
    _delete_avatar_assets(user)
    user.avatar = None
    user.save(update_fields=["avatar"])
    return _serialize_profile(user)


@router.get("/invitations/{token}/", response=PublicMembershipInvitationSchema)
def get_membership_invitation(request, token: str):
    """Return public invitation details for one token."""

    del request
    return _serialize_public_invitation(_get_invitation_or_404(token))


@router.post(
    "/invitations/{token}/",
    response={
        200: PublicMembershipInvitationSchema,
        400: dict[str, list[str]],
        403: dict[str, str],
    },
    auth=api_authenticate,
)
def accept_membership_invitation(request, token: str):
    """Accept a project invitation for the authenticated user."""

    invitation = _get_invitation_or_404(token)
    if invitation.revoked_at is not None:
        return Status(400, {"token": ["This invitation has been revoked."]})
    if invitation.accepted_at is not None:
        return Status(400, {"token": ["This invitation has already been accepted."]})

    user = cast(AppUser, request.user)
    user_email = (user.email or "").strip().lower()
    invitation_email = invitation.email.strip().lower()
    if not user_email or user_email != invitation_email:
        return Status(
            403, {"detail": f"Sign in as {invitation.email} to accept this invite."}
        )

    membership, created = ProjectMembership.objects.update_or_create(
        user=user,
        project=invitation.project,
        defaults={
            "role": invitation.role,
            "invited_by": invitation.invited_by,
        },
    )
    if created and membership.joined_at is None:
        membership.save(update_fields=["joined_at"])

    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=["accepted_at"])
    return _serialize_public_invitation(invitation)


__all__ = ["router"]
