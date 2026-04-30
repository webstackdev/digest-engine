"""Serializers for the custom user profile surface."""

from rest_framework import serializers

from users.models import (
    AVATAR_ALLOWED_CONTENT_TYPES,
    AVATAR_MAX_FILE_SIZE,
    AppUser,
)


class AppUserSerializer(serializers.ModelSerializer):
    """Serialize the core user identity fields used by backend callers."""

    avatar_url = serializers.ReadOnlyField()
    avatar_thumbnail_url = serializers.ReadOnlyField()

    class Meta:
        model = AppUser
        fields = [
            "id",
            "username",
            "email",
            "display_name",
            "avatar",
            "avatar_url",
            "avatar_thumbnail_url",
            "bio",
            "timezone",
            "first_name",
            "last_name",
        ]
        read_only_fields = ["id"]


class ProfileSerializer(AppUserSerializer):
    """Alias serializer used for profile-focused endpoints."""

    class Meta(AppUserSerializer.Meta):
        read_only_fields = [
            "id",
            "username",
            "email",
            "avatar",
            "avatar_url",
            "avatar_thumbnail_url",
            "first_name",
            "last_name",
        ]


class AvatarUploadSerializer(serializers.Serializer):
    """Validate one uploaded avatar file for the current user."""

    avatar = serializers.ImageField()

    def validate_avatar(self, value):
        """Accept only supported image types under the configured size limit."""

        content_type = getattr(value, "content_type", "")
        if content_type not in AVATAR_ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError(
                "Upload a PNG, JPEG, or WebP avatar image."
            )
        if value.size > AVATAR_MAX_FILE_SIZE:
            raise serializers.ValidationError("Avatar images must be 2 MB or smaller.")
        return value
