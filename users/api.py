"""Current-user profile API endpoints for the users app."""

from __future__ import annotations

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import AppUser, avatar_thumbnail_path
from users.serializers import AvatarUploadSerializer, ProfileSerializer
from users.tasks import generate_avatar_thumbnail


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
        user.avatar = serializer.validated_data["avatar"]
        user.save(update_fields=["avatar"])

        if settings.CELERY_TASK_ALWAYS_EAGER:
            generate_avatar_thumbnail(user.id)
        else:
            generate_avatar_thumbnail.delay(user.id)

        return Response(ProfileSerializer(user).data, status=status.HTTP_200_OK)

    @extend_schema(responses={200: ProfileSerializer})
    def delete(self, request):
        """Remove the current user's avatar image and generated thumbnail."""

        user = request.user
        _delete_avatar_assets(user)
        user.avatar = None
        user.save(update_fields=["avatar"])
        return Response(ProfileSerializer(user).data)
