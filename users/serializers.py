"""Serializers for the custom user profile surface."""

from rest_framework import serializers

from users.models import AppUser


class AppUserSerializer(serializers.ModelSerializer):
    """Serialize the core user identity fields used by backend callers."""

    class Meta:
        model = AppUser
        fields = [
            "id",
            "username",
            "email",
            "display_name",
            "avatar",
            "bio",
            "timezone",
            "first_name",
            "last_name",
        ]
        read_only_fields = ["id"]


class ProfileSerializer(AppUserSerializer):
    """Alias serializer used for profile-focused endpoints."""
