"""Serializers for the custom user profile surface."""

from django.conf import settings
from rest_framework import serializers

from users.models import (
    AVATAR_ALLOWED_CONTENT_TYPES,
    AVATAR_MAX_FILE_SIZE,
    AppUser,
    MembershipInvitation,
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


class MembershipInvitationSerializer(serializers.ModelSerializer):
    """Serialize one project invitation for project-admin workflows."""

    invited_by_email = serializers.SerializerMethodField()
    invite_url = serializers.SerializerMethodField()

    class Meta:
        model = MembershipInvitation
        fields = [
            "id",
            "project",
            "email",
            "role",
            "token",
            "invited_by",
            "invited_by_email",
            "invite_url",
            "created_at",
            "accepted_at",
            "revoked_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "token",
            "invited_by",
            "invited_by_email",
            "invite_url",
            "created_at",
            "accepted_at",
            "revoked_at",
        ]

    def validate_email(self, value: str) -> str:
        """Normalize invited email addresses to lower-case."""

        return value.strip().lower()

    def validate(self, attrs):
        """Reject duplicate active invitations and existing memberships."""

        attrs = super().validate(attrs)
        project = self.context.get("project")
        if project is None:
            return attrs

        email = attrs.get("email", "").strip().lower()
        if not email:
            return attrs

        if project.memberships.filter(user__email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "That user is already a project member."}
            )

        active_invitation_exists = MembershipInvitation.objects.filter(
            project=project,
            email__iexact=email,
            accepted_at__isnull=True,
            revoked_at__isnull=True,
        ).exists()
        if active_invitation_exists:
            raise serializers.ValidationError(
                {"email": "An active invitation already exists for this email."}
            )

        return attrs

    def get_invited_by_email(self, obj: MembershipInvitation) -> str:
        """Return the inviter email when available."""

        return obj.invited_by.email if obj.invited_by else ""

    def get_invite_url(self, obj: MembershipInvitation) -> str:
        """Return the frontend invitation URL for the token."""

        return f"{settings.FRONTEND_BASE_URL.rstrip('/')}/invite/{obj.token}"


class PublicMembershipInvitationSerializer(serializers.ModelSerializer):
    """Serialize invitation details safe to expose on the public invite page."""

    project_id = serializers.IntegerField(source="project.id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = MembershipInvitation
        fields = [
            "token",
            "project_id",
            "project_name",
            "email",
            "role",
            "status",
            "accepted_at",
            "revoked_at",
        ]
        read_only_fields = fields

    def get_status(self, obj: MembershipInvitation) -> str:
        """Return a simple token lifecycle status for the invite page."""

        if obj.revoked_at is not None:
            return "revoked"
        if obj.accepted_at is not None:
            return "accepted"
        return "pending"
