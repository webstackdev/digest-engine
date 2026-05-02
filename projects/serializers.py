"""DRF serializers for project-owned models."""

import logging

from rest_framework import serializers

from core.permissions import get_user_role
from core.serializer_mixins import ProjectScopedSerializerMixin
from ingestion.plugins import validate_plugin_config
from projects.models import (
    BlueskyCredentials,
    LinkedInCredentials,
    MastodonCredentials,
    Project,
    ProjectConfig,
    ProjectMembership,
    ProjectRole,
    SourceConfig,
)

logger = logging.getLogger(__name__)


class ProjectSerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize top-level project records."""

    user_role = serializers.SerializerMethodField()
    has_bluesky_credentials = serializers.SerializerMethodField()
    bluesky_handle = serializers.SerializerMethodField()
    bluesky_is_active = serializers.SerializerMethodField()
    bluesky_last_verified_at = serializers.SerializerMethodField()
    bluesky_last_error = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "topic_description",
            "content_retention_days",
            "intake_token",
            "intake_enabled",
            "user_role",
            "has_bluesky_credentials",
            "bluesky_handle",
            "bluesky_is_active",
            "bluesky_last_verified_at",
            "bluesky_last_error",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_user_role(self, obj: Project) -> str | None:
        """Return the current request user's role for this project."""

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return get_user_role(request.user, obj)

    def _get_bluesky_credentials(self, obj: Project) -> BlueskyCredentials | None:
        """Return the project's stored Bluesky credentials, if configured."""

        return BlueskyCredentials.objects.filter(project=obj).first()

    def get_has_bluesky_credentials(self, obj: Project) -> bool:
        """Return whether the project has stored Bluesky credentials."""

        return self._get_bluesky_credentials(obj) is not None

    def get_bluesky_handle(self, obj: Project) -> str:
        """Return the stored Bluesky handle, or an empty string."""

        credentials = self._get_bluesky_credentials(obj)
        return credentials.handle if credentials else ""

    def get_bluesky_is_active(self, obj: Project) -> bool:
        """Return whether the stored Bluesky credentials are currently active."""

        credentials = self._get_bluesky_credentials(obj)
        return credentials.is_active if credentials else False

    def get_bluesky_last_verified_at(self, obj: Project):
        """Return the last successful verification timestamp, if available."""

        credentials = self._get_bluesky_credentials(obj)
        return credentials.last_verified_at if credentials else None

    def get_bluesky_last_error(self, obj: Project) -> str:
        """Return the latest Bluesky verification error, or an empty string."""

        credentials = self._get_bluesky_credentials(obj)
        return credentials.last_error if credentials else ""


class ProjectConfigSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize per-project authority and scoring settings."""

    class Meta:
        model = ProjectConfig
        fields = [
            "id",
            "project",
            "authority_weight_mention",
            "authority_weight_engagement",
            "authority_weight_recency",
            "authority_weight_source_quality",
            "authority_weight_cross_newsletter",
            "authority_weight_feedback",
            "authority_weight_duplicate",
            "upvote_authority_weight",
            "downvote_authority_weight",
            "authority_decay_rate",
        ]
        read_only_fields = ["id", "project"]


class BlueskyCredentialsSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize project-scoped Bluesky credentials without exposing secrets."""

    app_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    has_stored_credential = serializers.SerializerMethodField()

    class Meta:
        model = BlueskyCredentials
        fields = [
            "id",
            "project",
            "handle",
            "pds_url",
            "is_active",
            "has_stored_credential",
            "app_password",
            "last_verified_at",
            "last_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "has_stored_credential",
            "last_verified_at",
            "last_error",
            "created_at",
            "updated_at",
        ]

    def get_has_stored_credential(self, obj: BlueskyCredentials) -> bool:
        """Return whether the project has an encrypted Bluesky credential stored."""

        return obj.has_stored_credential()

    def validate(self, attrs):
        """Require an app password when creating a credential record."""

        attrs = super().validate(attrs)
        app_password = attrs.get("app_password", "")
        if self.instance is None and not app_password:
            raise serializers.ValidationError(
                {"app_password": "A Bluesky app credential is required."}
            )
        return attrs

    def create(self, validated_data):
        """Encrypt the submitted Bluesky app password before saving the record."""

        app_password = validated_data.pop("app_password", "")
        instance = super().create(validated_data)
        if app_password:
            instance.set_app_password(app_password)
            instance.save(update_fields=["app_password_encrypted", "updated_at"])
        return instance


class MastodonCredentialsSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize project-scoped Mastodon credentials without exposing secrets."""

    access_token = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    has_stored_credential = serializers.SerializerMethodField()

    class Meta:
        model = MastodonCredentials
        fields = [
            "id",
            "project",
            "instance_url",
            "account_acct",
            "is_active",
            "has_stored_credential",
            "access_token",
            "last_verified_at",
            "last_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "has_stored_credential",
            "last_verified_at",
            "last_error",
            "created_at",
            "updated_at",
        ]

    def get_has_stored_credential(self, obj: MastodonCredentials) -> bool:
        """Return whether the project has an encrypted Mastodon token stored."""

        return obj.has_stored_credential()

    def validate(self, attrs):
        """Require an access token when creating a credential record."""

        attrs = super().validate(attrs)
        access_token = attrs.get("access_token", "")
        if self.instance is None and not access_token:
            raise serializers.ValidationError(
                {"access_token": "A Mastodon access token is required."}
            )
        return attrs

    def create(self, validated_data):
        """Encrypt the submitted Mastodon access token before saving the record."""

        access_token = validated_data.pop("access_token", "")
        instance = super().create(validated_data)
        if access_token:
            instance.set_access_token(access_token)
            instance.save(update_fields=["access_token_encrypted", "updated_at"])
        return instance

    def update(self, instance, validated_data):
        """Keep the stored token unless a replacement access token is submitted."""

        access_token = validated_data.pop("access_token", "")
        instance = super().update(instance, validated_data)
        if access_token:
            instance.set_access_token(access_token)
            instance.save(update_fields=["access_token_encrypted", "updated_at"])
        return instance


class LinkedInCredentialsSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize project-scoped LinkedIn credentials without exposing tokens."""

    access_token = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    refresh_token = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    has_stored_credential = serializers.SerializerMethodField()

    class Meta:
        model = LinkedInCredentials
        fields = [
            "id",
            "project",
            "member_urn",
            "expires_at",
            "is_active",
            "has_stored_credential",
            "access_token",
            "refresh_token",
            "last_verified_at",
            "last_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "has_stored_credential",
            "last_verified_at",
            "last_error",
            "created_at",
            "updated_at",
        ]

    def get_has_stored_credential(self, obj: LinkedInCredentials) -> bool:
        """Return whether the project has both encrypted LinkedIn tokens stored."""

        return obj.has_stored_credential()

    def validate(self, attrs):
        """Require both OAuth tokens when creating a LinkedIn credential record."""

        attrs = super().validate(attrs)
        access_token = attrs.get("access_token", "")
        refresh_token = attrs.get("refresh_token", "")
        if self.instance is None:
            if not access_token:
                raise serializers.ValidationError(
                    {"access_token": "A LinkedIn access token is required."}
                )
            if not refresh_token:
                raise serializers.ValidationError(
                    {"refresh_token": "A LinkedIn refresh token is required."}
                )
        return attrs

    def create(self, validated_data):
        """Encrypt submitted LinkedIn OAuth tokens before saving the record."""

        access_token = validated_data.pop("access_token", "")
        refresh_token = validated_data.pop("refresh_token", "")
        instance = super().create(validated_data)
        update_fields = ["updated_at"]
        if access_token:
            instance.set_access_token(access_token)
            update_fields.append("access_token_encrypted")
        if refresh_token:
            instance.set_refresh_token(refresh_token)
            update_fields.append("refresh_token_encrypted")
        if len(update_fields) > 1:
            instance.save(update_fields=update_fields)
        return instance

    def update(self, instance, validated_data):
        """Keep stored LinkedIn tokens unless replacements are submitted."""

        access_token = validated_data.pop("access_token", "")
        refresh_token = validated_data.pop("refresh_token", "")
        instance = super().update(instance, validated_data)
        update_fields = ["updated_at"]
        if access_token:
            instance.set_access_token(access_token)
            update_fields.append("access_token_encrypted")
        if refresh_token:
            instance.set_refresh_token(refresh_token)
            update_fields.append("refresh_token_encrypted")
        if len(update_fields) > 1:
            instance.save(update_fields=update_fields)
        return instance


class SourceConfigSerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize source-plugin configuration and normalize provider settings."""

    class Meta:
        model = SourceConfig
        fields = [
            "id",
            "project",
            "plugin_name",
            "config",
            "is_active",
            "last_fetched_at",
        ]
        read_only_fields = ["id", "project", "last_fetched_at"]

    def validate(self, attrs):
        """Validate plugin-specific configuration with the plugin registry."""

        plugin_name = attrs.get("plugin_name") or getattr(
            self.instance, "plugin_name", None
        )
        config = attrs.get("config") or getattr(self.instance, "config", {})
        if plugin_name:
            try:
                attrs["config"] = validate_plugin_config(plugin_name, config)
            except ValueError as exc:
                logger.warning(
                    "Rejected invalid source config",
                    extra={"plugin_name": str(plugin_name)},
                    exc_info=exc,
                )
                raise serializers.ValidationError(
                    {"config": "Invalid source configuration."}
                )
        return attrs


class ProjectMembershipSerializer(serializers.ModelSerializer):
    """Serialize project-member roster entries for admin workflows."""

    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    display_name = serializers.CharField(source="user.display_name", read_only=True)

    class Meta:
        model = ProjectMembership
        fields = [
            "id",
            "project",
            "user",
            "username",
            "email",
            "display_name",
            "role",
            "invited_by",
            "joined_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "user",
            "username",
            "email",
            "display_name",
            "invited_by",
            "joined_at",
        ]

    def validate_role(self, value: str) -> str:
        """Restrict role updates to the supported project-role values."""

        if value not in ProjectRole.values:
            raise serializers.ValidationError("Select a valid project role.")
        return value
