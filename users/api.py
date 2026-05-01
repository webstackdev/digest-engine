"""Current-user profile API endpoints for the users app."""

from __future__ import annotations

from typing import Any, Protocol, cast

from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import ProjectMembership
from users.models import AppUser, MembershipInvitation, avatar_thumbnail_path
from users.serializers import (
    AvatarUploadSerializer,
    ProfileSerializer,
    PublicMembershipInvitationSerializer,
)
from users.tasks import generate_avatar_thumbnail


class DelayedTask(Protocol):
    """Protocol for Celery tasks dispatched through ``delay``."""

    def delay(self, *args: object, **kwargs: object) -> object:
        pass


def _enqueue_task(task: object, *args: object) -> None:
    """Dispatch a Celery task through a typed ``delay`` seam."""

    cast(DelayedTask, task).delay(*args)


def _validated_data(serializer: Any) -> dict[str, Any]:
    """Return validated avatar-upload serializer data with a concrete mapping type."""

    return cast(dict[str, Any], serializer.validated_data)


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


@extend_schema(tags=["Users"])
class ProfileView(APIView):
    """Expose the authenticated user's editable profile surface."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: ProfileSerializer})
    def get(self, request):
        """Return the current user's profile payload."""

        serializer = ProfileSerializer(request.user)
        return Response(serializer.data)

    @extend_schema(request=ProfileSerializer, responses={200: ProfileSerializer})
    def patch(self, request):
        """Update display-name and profile-text fields for the current user."""

        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProfileSerializer(request.user).data)


@extend_schema(tags=["Users"])
class ProfileAvatarView(APIView):
    """Create or delete the authenticated user's avatar image."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(request=AvatarUploadSerializer, responses={200: ProfileSerializer})
    def post(self, request):
        """Store a new avatar image for the current user and queue a thumbnail."""

        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        _delete_avatar_assets(user)
        user.avatar = _validated_data(serializer)["avatar"]
        user.save(update_fields=["avatar"])

        if settings.CELERY_TASK_ALWAYS_EAGER:
            generate_avatar_thumbnail(user.id)
        else:
            _enqueue_task(generate_avatar_thumbnail, user.id)

        return Response(ProfileSerializer(user).data, status=status.HTTP_200_OK)

    @extend_schema(responses={200: ProfileSerializer})
    def delete(self, request):
        """Remove the current user's avatar image and generated thumbnail."""

        user = request.user
        _delete_avatar_assets(user)
        user.avatar = None
        user.save(update_fields=["avatar"])
        return Response(ProfileSerializer(user).data)


@extend_schema(tags=["Users"])
class MembershipInvitationTokenView(APIView):
    """Expose and redeem one invitation token."""

    def get_permissions(self):
        """Allow anyone to inspect an invitation, but require auth to accept it."""

        if self.request.method == "GET":
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    def _get_invitation(self, token: str) -> MembershipInvitation:
        """Load one invitation row by token or return 404."""

        return MembershipInvitation.objects.select_related("project", "invited_by").get(
            token=token
        )

    @extend_schema(responses={200: PublicMembershipInvitationSerializer})
    def get(self, request, token: str):
        """Return public invite details for one token."""

        invitation = self._get_invitation(token)
        return Response(PublicMembershipInvitationSerializer(invitation).data)

    @extend_schema(responses={200: PublicMembershipInvitationSerializer})
    def post(self, request, token: str):
        """Accept a project invitation for the authenticated user."""

        invitation = self._get_invitation(token)
        if invitation.revoked_at is not None:
            raise serializers.ValidationError(
                {"token": "This invitation has been revoked."}
            )
        if invitation.accepted_at is not None:
            raise serializers.ValidationError(
                {"token": "This invitation has already been accepted."}
            )

        user_email = (request.user.email or "").strip().lower()
        invitation_email = invitation.email.strip().lower()
        if not user_email or user_email != invitation_email:
            raise PermissionDenied(
                f"Sign in as {invitation.email} to accept this invite."
            )

        membership, created = ProjectMembership.objects.update_or_create(
            user=request.user,
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

        return Response(PublicMembershipInvitationSerializer(invitation).data)
