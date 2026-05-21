"""Django Ninja endpoints for the first increment of the users API migration."""

from __future__ import annotations

from typing import Any, cast

from django.conf import settings
from django.utils import timezone
from ninja import File, Router, Schema
from ninja.errors import HttpError
from ninja.files import UploadedFile
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied

from core.ninja_api import drf_authenticate
from projects.models import ProjectMembership
from users.api import _delete_avatar_assets, _enqueue_task, _validated_data
from users.models import AppUser, MembershipInvitation
from users.serializers import (
    AvatarUploadSerializer,
    ProfileSerializer,
    PublicMembershipInvitationSerializer,
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

    return cast(dict[str, Any], ProfileSerializer(user).data)


def _serialize_public_invitation(invitation: MembershipInvitation) -> dict[str, Any]:
    """Return the public invitation response body for one token."""

    return cast(dict[str, Any], PublicMembershipInvitationSerializer(invitation).data)


def _get_invitation_or_404(token: str) -> MembershipInvitation:
    """Load one invitation row by token or raise a Ninja 404."""

    try:
        return MembershipInvitation.objects.select_related("project", "invited_by").get(
            token=token
        )
    except MembershipInvitation.DoesNotExist as exc:
        raise HttpError(404, {"detail": "Not found."}) from exc


@router.get("/profile/", response=UserProfileSchema, auth=drf_authenticate)
def get_profile(request):
    """Return the current authenticated user's profile payload."""

    return _serialize_profile(cast(AppUser, request.user))


@router.patch("/profile/", response=UserProfileSchema, auth=drf_authenticate)
def patch_profile(request, payload: ProfileUpdateInput):
    """Update the current user's editable profile fields."""

    user = cast(AppUser, request.user)
    serializer = ProfileSerializer(
        user,
        data=payload.model_dump(exclude_unset=True),
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_profile(user)


@router.post(
    "/profile/avatar/",
    response=UserProfileSchema,
    auth=drf_authenticate,
)
def upload_profile_avatar(request, avatar: File[UploadedFile]):
    """Store a new avatar image for the current user and queue a thumbnail."""

    serializer = AvatarUploadSerializer(data={"avatar": avatar})
    serializer.is_valid(raise_exception=True)

    user = cast(AppUser, request.user)
    _delete_avatar_assets(user)
    user.avatar = _validated_data(serializer)["avatar"]
    user.save(update_fields=["avatar"])

    if settings.CELERY_TASK_ALWAYS_EAGER:
        generate_avatar_thumbnail(user.id)
    else:
        _enqueue_task(generate_avatar_thumbnail, user.id)

    return _serialize_profile(user)


@router.delete(
    "/profile/avatar/",
    response=UserProfileSchema,
    auth=drf_authenticate,
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
    response=PublicMembershipInvitationSchema,
    auth=drf_authenticate,
)
def accept_membership_invitation(request, token: str):
    """Accept a project invitation for the authenticated user."""

    invitation = _get_invitation_or_404(token)
    if invitation.revoked_at is not None:
        raise serializers.ValidationError(
            {"token": "This invitation has been revoked."}
        )
    if invitation.accepted_at is not None:
        raise serializers.ValidationError(
            {"token": "This invitation has already been accepted."}
        )

    user = cast(AppUser, request.user)
    user_email = (user.email or "").strip().lower()
    invitation_email = invitation.email.strip().lower()
    if not user_email or user_email != invitation_email:
        raise PermissionDenied(f"Sign in as {invitation.email} to accept this invite.")

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
