"""Project-owned models split out from the historical core app."""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings
from django.db import models

from projects.model_support import (
    SourcePluginName,
    bluesky_credentials_fernet,
    generate_project_intake_token,
    linkedin_credentials_fernet,
    normalize_linkedin_urn,
    mastodon_credentials_fernet,
    normalize_bluesky_handle,
    normalize_bluesky_pds_url,
    normalize_mastodon_handle,
    normalize_mastodon_instance_url,
)

if TYPE_CHECKING:
    from users.models import AppUser


class ProjectRole(models.TextChoices):
    """Role assigned to a user's membership within one project."""

    ADMIN = "admin", "Project Admin"
    MEMBER = "member", "Project Member"
    READER = "reader", "Project Reader"


class Project(models.Model):
    """Represents a newsletter workspace owned through project memberships."""

    name = models.CharField(max_length=255)
    members: models.ManyToManyField[AppUser, ProjectMembership] = (
        models.ManyToManyField(
            settings.AUTH_USER_MODEL,
            through="ProjectMembership",
            through_fields=("project", "user"),
            related_name="projects",
            blank=True,
        )
    )
    topic_description = models.TextField()
    content_retention_days = models.PositiveIntegerField(default=365)
    intake_token = models.CharField(
        max_length=64,
        unique=True,
        default=generate_project_intake_token,
        editable=False,
    )
    intake_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        db_table = "core_project"

    def __str__(self) -> str:
        return self.name


class ProjectMembership(models.Model):
    """Associate one user with one project and an authorization role."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(
        max_length=16,
        choices=ProjectRole.choices,
        default=ProjectRole.MEMBER,
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="memberships_invited",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["project__name", "user__username"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "project"],
                name="projects_membership_unique_user_project",
            )
        ]
        indexes = [
            models.Index(fields=["project", "role"]),
            models.Index(fields=["user", "project"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} in {self.project} ({self.role})"


class BlueskyCredentials(models.Model):
    """Stores the authenticated Bluesky account used by one project."""

    project = models.OneToOneField(
        Project, on_delete=models.CASCADE, related_name="bluesky_credentials"
    )
    handle = models.CharField(max_length=255)
    app_password_encrypted = models.TextField(blank=True)
    pds_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["project__name"]
        verbose_name_plural = "Bluesky credentials"
        db_table = "core_blueskycredentials"

    def __str__(self) -> str:
        return f"Bluesky credentials for {self.project.name}"

    @property
    def client_base_url(self) -> str:
        """Return the effective base URL used by the ATProto client."""

        if not self.pds_url:
            return "https://bsky.social/xrpc"
        return f"{self.pds_url.rstrip('/')}/xrpc"

    def has_app_password(self) -> bool:
        """Return whether an encrypted app password has been stored."""

        return bool(self.app_password_encrypted)

    def has_stored_credential(self) -> bool:
        """Return whether an encrypted Bluesky credential has been stored."""

        return self.has_app_password()

    def set_app_password(self, app_password: str) -> None:
        """Encrypt and store the given Bluesky app password."""

        if not app_password:
            self.app_password_encrypted = ""
            return
        self.app_password_encrypted = (
            bluesky_credentials_fernet()
            .encrypt(app_password.encode("utf-8"))
            .decode("utf-8")
        )

    def set_stored_credential(self, credential_value: str) -> None:
        """Encrypt and store the given Bluesky credential value."""

        self.set_app_password(credential_value)

    def get_app_password(self) -> str:
        """Decrypt and return the stored Bluesky app password."""

        if not self.app_password_encrypted:
            return ""
        return (
            bluesky_credentials_fernet()
            .decrypt(self.app_password_encrypted.encode("utf-8"))
            .decode("utf-8")
        )

    def get_stored_credential(self) -> str:
        """Decrypt and return the stored Bluesky credential value."""

        return self.get_app_password()

    def save(self, *args, **kwargs):
        """Normalize stored account fields before persisting the credentials."""

        self.handle = normalize_bluesky_handle(self.handle)
        self.pds_url = normalize_bluesky_pds_url(self.pds_url)
        super().save(*args, **kwargs)


class MastodonCredentials(models.Model):
    """Stores one project's optional Mastodon API token for one instance."""

    project = models.OneToOneField(
        Project, on_delete=models.CASCADE, related_name="mastodon_credentials"
    )
    instance_url = models.URLField(blank=True)
    account_acct = models.CharField(max_length=255, blank=True)
    access_token_encrypted = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["project__name"]
        verbose_name_plural = "Mastodon credentials"
        db_table = "projects_mastodoncredentials"

    def __str__(self) -> str:
        return f"Mastodon credentials for {self.project.name}"

    @property
    def api_base_url(self) -> str:
        """Return the normalized instance URL used for API requests."""

        return normalize_mastodon_instance_url(self.instance_url)

    def has_access_token(self) -> bool:
        """Return whether an encrypted access token has been stored."""

        return bool(self.access_token_encrypted)

    def has_stored_credential(self) -> bool:
        """Return whether an encrypted Mastodon credential has been stored."""

        return self.has_access_token()

    def set_access_token(self, access_token: str) -> None:
        """Encrypt and store the given Mastodon access token."""

        if not access_token:
            self.access_token_encrypted = ""
            return
        self.access_token_encrypted = (
            mastodon_credentials_fernet()
            .encrypt(access_token.encode("utf-8"))
            .decode("utf-8")
        )

    def set_stored_credential(self, credential_value: str) -> None:
        """Encrypt and store the given Mastodon credential value."""

        self.set_access_token(credential_value)

    def get_access_token(self) -> str:
        """Decrypt and return the stored Mastodon access token."""

        if not self.access_token_encrypted:
            return ""
        return (
            mastodon_credentials_fernet()
            .decrypt(self.access_token_encrypted.encode("utf-8"))
            .decode("utf-8")
        )

    def get_stored_credential(self) -> str:
        """Decrypt and return the stored Mastodon credential value."""

        return self.get_access_token()

    def save(self, *args, **kwargs):
        """Normalize the stored instance and account fields before save."""

        self.instance_url = normalize_mastodon_instance_url(self.instance_url)
        self.account_acct = normalize_mastodon_handle(
            self.account_acct,
            instance_url=self.instance_url,
        )
        super().save(*args, **kwargs)


class LinkedInCredentials(models.Model):
    """Stores one project's LinkedIn OAuth access and refresh tokens."""

    project = models.OneToOneField(
        Project, on_delete=models.CASCADE, related_name="linkedin_credentials"
    )
    member_urn = models.CharField(max_length=255, blank=True)
    access_token_encrypted = models.TextField(blank=True)
    refresh_token_encrypted = models.TextField(blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["project__name"]
        verbose_name_plural = "LinkedIn credentials"
        db_table = "projects_linkedincredentials"

    def __str__(self) -> str:
        return f"LinkedIn credentials for {self.project.name}"

    def has_access_token(self) -> bool:
        """Return whether an encrypted LinkedIn access token has been stored."""

        return bool(self.access_token_encrypted)

    def has_refresh_token(self) -> bool:
        """Return whether an encrypted LinkedIn refresh token has been stored."""

        return bool(self.refresh_token_encrypted)

    def has_stored_credential(self) -> bool:
        """Return whether both encrypted LinkedIn OAuth tokens are present."""

        return self.has_access_token() and self.has_refresh_token()

    def set_access_token(self, access_token: str) -> None:
        """Encrypt and store the given LinkedIn access token."""

        if not access_token:
            self.access_token_encrypted = ""
            return
        self.access_token_encrypted = (
            linkedin_credentials_fernet()
            .encrypt(access_token.encode("utf-8"))
            .decode("utf-8")
        )

    def get_access_token(self) -> str:
        """Decrypt and return the stored LinkedIn access token."""

        if not self.access_token_encrypted:
            return ""
        return (
            linkedin_credentials_fernet()
            .decrypt(self.access_token_encrypted.encode("utf-8"))
            .decode("utf-8")
        )

    def set_refresh_token(self, refresh_token: str) -> None:
        """Encrypt and store the given LinkedIn refresh token."""

        if not refresh_token:
            self.refresh_token_encrypted = ""
            return
        self.refresh_token_encrypted = (
            linkedin_credentials_fernet()
            .encrypt(refresh_token.encode("utf-8"))
            .decode("utf-8")
        )

    def get_refresh_token(self) -> str:
        """Decrypt and return the stored LinkedIn refresh token."""

        if not self.refresh_token_encrypted:
            return ""
        return (
            linkedin_credentials_fernet()
            .decrypt(self.refresh_token_encrypted.encode("utf-8"))
            .decode("utf-8")
        )

    def save(self, *args, **kwargs):
        """Normalize the stored LinkedIn member URN before save."""

        if self.member_urn:
            self.member_urn = normalize_linkedin_urn(self.member_urn)
        super().save(*args, **kwargs)


class ProjectConfig(models.Model):
    """Stores tunable scoring parameters for a single project."""

    project = models.OneToOneField(
        Project, on_delete=models.CASCADE, related_name="config"
    )
    authority_weight_mention = models.FloatField(default=0.20)
    authority_weight_engagement = models.FloatField(default=0.15)
    authority_weight_recency = models.FloatField(default=0.15)
    authority_weight_source_quality = models.FloatField(default=0.15)
    authority_weight_cross_newsletter = models.FloatField(default=0.20)
    authority_weight_feedback = models.FloatField(default=0.10)
    authority_weight_duplicate = models.FloatField(default=0.05)
    upvote_authority_weight = models.FloatField(default=0.1)
    downvote_authority_weight = models.FloatField(default=-0.05)
    authority_decay_rate = models.FloatField(default=0.95)
    recompute_topic_centroid_on_feedback_save = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Project config"
        verbose_name_plural = "Project configs"
        db_table = "core_projectconfig"

    def __str__(self) -> str:
        return f"Config for {self.project.name}"


class SourceConfig(models.Model):
    """Configures one ingestion source for a project."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="source_configs"
    )
    plugin_name = models.CharField(max_length=64, choices=SourcePluginName.choices)
    config = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    last_fetched_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["plugin_name", "id"]
        indexes = [
            models.Index(fields=["project", "plugin_name", "is_active"]),
        ]
        db_table = "core_sourceconfig"

    def __str__(self) -> str:
        return f"{self.plugin_name} source for {self.project.name}"
