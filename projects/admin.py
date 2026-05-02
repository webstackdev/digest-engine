"""Admin configuration for project-owned models."""

import json
from typing import TYPE_CHECKING, Any, cast

from django import forms
from django.contrib import admin, messages
from django.conf import settings
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from import_export.admin import ExportActionMixin
from unfold.admin import ModelAdmin

from ingestion.plugins import get_plugin_for_source_config, validate_plugin_config
from projects.models import (
    BlueskyCredentials,
    LinkedInCredentials,
    MastodonCredentials,
    Project,
    ProjectConfig,
    ProjectMembership,
    SourceConfig,
)

if TYPE_CHECKING:

    class ProjectAdminBase(ModelAdmin):
        """Typed admin base that avoids import-export stub conflicts."""

else:

    class ProjectAdminBase(ExportActionMixin, ModelAdmin):
        """Runtime admin base that preserves export support."""


class ProjectMembershipInline(admin.TabularInline):
    """Edit project memberships inline from the project admin."""

    model = ProjectMembership
    extra = 0
    autocomplete_fields = ("user", "invited_by")


class BlueskyCredentialsAdminForm(forms.ModelForm):
    """Admin form that accepts a plaintext Bluesky app credential input."""

    credential_input = forms.CharField(
        required=False,
        strip=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Leave blank to keep the existing stored credential.",
        label="Bluesky app credential",
    )

    class Meta:
        model = BlueskyCredentials
        fields = ["project", "handle", "pds_url", "is_active"]

    def clean(self):
        """Require a credential when creating the record for the first time."""

        cleaned_data = super().clean() or {}
        credential_input = cleaned_data.get("credential_input", "")
        if not self.instance.has_stored_credential() and not credential_input:
            self.add_error("credential_input", "A Bluesky app credential is required.")
        return cleaned_data

    def save(self, commit=True):
        """Encrypt a new credential value before saving the model instance."""

        instance = super().save(commit=False)
        credential_input = self.cleaned_data.get("credential_input", "")
        if credential_input:
            instance.set_stored_credential(credential_input)
        if commit:
            instance.save()
        return instance


class MastodonCredentialsAdminForm(forms.ModelForm):
    """Admin form that accepts a plaintext Mastodon access token input."""

    credential_input = forms.CharField(
        required=False,
        strip=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Leave blank to keep the existing stored access token.",
        label="Mastodon access token",
    )

    class Meta:
        model = MastodonCredentials
        fields = ["project", "instance_url", "account_acct", "is_active"]

    def clean(self):
        """Require a token when creating the record for the first time."""

        cleaned_data = super().clean() or {}
        credential_input = cleaned_data.get("credential_input", "")
        if not self.instance.has_stored_credential() and not credential_input:
            self.add_error("credential_input", "A Mastodon access token is required.")
        return cleaned_data

    def save(self, commit=True):
        """Encrypt a new token value before saving the model instance."""

        instance = super().save(commit=False)
        credential_input = self.cleaned_data.get("credential_input", "")
        if credential_input:
            instance.set_stored_credential(credential_input)
        if commit:
            instance.save()
        return instance


class LinkedInCredentialsAdminForm(forms.ModelForm):
    """Admin form that accepts plaintext LinkedIn OAuth tokens."""

    access_token_input = forms.CharField(
        required=False,
        strip=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Leave blank to keep the existing stored access token.",
        label="LinkedIn access token",
    )
    refresh_token_input = forms.CharField(
        required=False,
        strip=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Leave blank to keep the existing stored refresh token.",
        label="LinkedIn refresh token",
    )

    class Meta:
        model = LinkedInCredentials
        fields = ["project", "member_urn", "expires_at", "is_active"]

    def clean(self):
        """Require both OAuth tokens when creating the record for the first time."""

        cleaned_data = super().clean() or {}
        access_token_input = cleaned_data.get("access_token_input", "")
        refresh_token_input = cleaned_data.get("refresh_token_input", "")
        if not self.instance.has_access_token() and not access_token_input:
            self.add_error("access_token_input", "A LinkedIn access token is required.")
        if not self.instance.has_refresh_token() and not refresh_token_input:
            self.add_error(
                "refresh_token_input", "A LinkedIn refresh token is required."
            )
        return cleaned_data

    def save(self, commit=True):
        """Encrypt new token values before saving the model instance."""

        instance = super().save(commit=False)
        access_token_input = self.cleaned_data.get("access_token_input", "")
        refresh_token_input = self.cleaned_data.get("refresh_token_input", "")
        if access_token_input:
            instance.set_access_token(access_token_input)
        if refresh_token_input:
            instance.set_refresh_token(refresh_token_input)
        if commit:
            instance.save()
        return instance


@admin.register(Project)
class ProjectAdmin(ProjectAdminBase):
    """Admin configuration for top-level project workspaces."""

    list_display = ("name", "content_retention_days", "created_at")
    date_hierarchy = "created_at"
    list_filter = ("created_at",)
    search_fields = ("name",)
    list_editable = ("content_retention_days",)
    inlines = (ProjectMembershipInline,)


@admin.register(BlueskyCredentials)
class BlueskyCredentialsAdmin(ModelAdmin):
    """Admin view for project-scoped Bluesky authentication settings."""

    form = BlueskyCredentialsAdminForm
    actions = ["verify_selected_credentials"]
    list_display = (
        "project",
        "handle",
        "display_pds_host",
        "has_stored_credential",
        "is_active",
        "last_verified_at",
    )
    list_filter = ("is_active", ("project", admin.RelatedOnlyFieldListFilter))
    search_fields = ("project__name", "handle", "pds_url")
    autocomplete_fields = ("project",)
    readonly_fields = (
        "has_stored_credential",
        "last_verified_at",
        "last_error",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "Account",
            {"fields": ("project", "handle", "credential_input", "is_active")},
        ),
        (
            "PDS Override",
            {
                "fields": ("pds_url",),
                "description": "Leave blank to use the default Bluesky-hosted account flow.",
            },
        ),
        (
            "Verification",
            {
                "fields": (
                    "has_stored_credential",
                    "last_verified_at",
                    "last_error",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(description="PDS")
    def display_pds_host(self, obj):
        """Show whether the credentials use the hosted default or a custom PDS."""

        return obj.pds_url or "Bluesky hosted default"

    @admin.display(boolean=True, description="Stored Credential")
    def has_stored_credential(self, obj):
        """Return whether an encrypted Bluesky credential has been configured."""

        return obj.has_stored_credential()

    @admin.action(description="Verify Selected Credentials")
    def verify_selected_credentials(self, request, queryset):
        """Authenticate the selected Bluesky accounts and report the outcome."""

        from ingestion.plugins.bluesky import BlueskySourcePlugin

        verified_credentials = []
        failed_credentials = []

        for credentials in queryset.select_related("project"):
            try:
                BlueskySourcePlugin.verify_credentials(credentials)
            except Exception as exc:
                failed_credentials.append(f"{credentials}: {exc}")
            else:
                verified_credentials.append(str(credentials))

        if verified_credentials:
            self.message_user(
                request,
                f"Credential verification passed for {len(verified_credentials)} account(s).",
                messages.SUCCESS,
            )

        if failed_credentials:
            self.message_user(
                request,
                "Credential verification failed for: " + "; ".join(failed_credentials),
                messages.ERROR,
            )


@admin.register(MastodonCredentials)
class MastodonCredentialsAdmin(ModelAdmin):
    """Admin view for project-scoped Mastodon authentication settings."""

    form = MastodonCredentialsAdminForm
    actions = ["verify_selected_credentials"]
    list_display = (
        "project",
        "account_acct",
        "instance_url",
        "has_stored_credential",
        "is_active",
        "last_verified_at",
    )
    list_filter = ("is_active", ("project", admin.RelatedOnlyFieldListFilter))
    search_fields = ("project__name", "account_acct", "instance_url")
    autocomplete_fields = ("project",)
    readonly_fields = (
        "has_stored_credential",
        "last_verified_at",
        "last_error",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "Account",
            {
                "fields": (
                    "project",
                    "instance_url",
                    "account_acct",
                    "credential_input",
                    "is_active",
                )
            },
        ),
        (
            "Verification",
            {
                "fields": (
                    "has_stored_credential",
                    "last_verified_at",
                    "last_error",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(boolean=True, description="Stored Credential")
    def has_stored_credential(self, obj):
        """Return whether an encrypted Mastodon token has been configured."""

        return obj.has_stored_credential()

    @admin.action(description="Verify Selected Credentials")
    def verify_selected_credentials(self, request, queryset):
        """Authenticate the selected Mastodon tokens and report the outcome."""

        from ingestion.plugins.mastodon import MastodonSourcePlugin

        verified_credentials = []
        failed_credentials = []

        for credentials in queryset.select_related("project"):
            try:
                MastodonSourcePlugin.verify_credentials(credentials)
            except Exception as exc:
                failed_credentials.append(f"{credentials}: {exc}")
            else:
                verified_credentials.append(str(credentials))

        if verified_credentials:
            self.message_user(
                request,
                f"Credential verification passed for {len(verified_credentials)} account(s).",
                messages.SUCCESS,
            )

        if failed_credentials:
            self.message_user(
                request,
                "Credential verification failed for: " + "; ".join(failed_credentials),
                messages.ERROR,
            )


@admin.register(LinkedInCredentials)
class LinkedInCredentialsAdmin(ModelAdmin):
    """Admin view for project-scoped LinkedIn OAuth settings."""

    form = LinkedInCredentialsAdminForm
    actions = ["verify_selected_credentials"]
    list_display = (
        "project",
        "member_urn",
        "display_token_expiry",
        "has_stored_credential",
        "is_active",
        "last_verified_at",
    )
    list_filter = ("is_active", ("project", admin.RelatedOnlyFieldListFilter))
    search_fields = ("project__name", "member_urn")
    autocomplete_fields = ("project",)
    readonly_fields = (
        "has_stored_credential",
        "last_verified_at",
        "last_error",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "Account",
            {
                "fields": (
                    "project",
                    "member_urn",
                    "expires_at",
                    "access_token_input",
                    "refresh_token_input",
                    "is_active",
                )
            },
        ),
        (
            "Verification",
            {
                "fields": (
                    "has_stored_credential",
                    "last_verified_at",
                    "last_error",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(description="Expires")
    def display_token_expiry(self, obj):
        """Show when the current LinkedIn access token expires."""

        return obj.expires_at or "Unknown"

    @admin.display(boolean=True, description="Stored Credential")
    def has_stored_credential(self, obj):
        """Return whether both LinkedIn OAuth tokens have been configured."""

        return obj.has_stored_credential()

    @admin.action(description="Verify Selected Credentials")
    def verify_selected_credentials(self, request, queryset):
        """Authenticate the selected LinkedIn tokens and report the outcome."""

        from ingestion.plugins.linkedin import LinkedInSourcePlugin

        verified_credentials = []
        failed_credentials = []

        for credentials in queryset.select_related("project"):
            try:
                LinkedInSourcePlugin.verify_credentials(credentials)
            except Exception as exc:
                failed_credentials.append(f"{credentials}: {exc}")
            else:
                verified_credentials.append(str(credentials))

        if verified_credentials:
            self.message_user(
                request,
                f"Credential verification passed for {len(verified_credentials)} account(s).",
                messages.SUCCESS,
            )

        if failed_credentials:
            self.message_user(
                request,
                "Credential verification failed for: " + "; ".join(failed_credentials),
                messages.ERROR,
            )


@admin.register(ProjectConfig)
class ProjectConfigAdmin(admin.ModelAdmin):
    """Admin configuration for per-project scoring settings."""

    actions = ["recompute_selected_authority_models"]
    list_display = (
        "project",
        "draft_schedule_cron",
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
        "recompute_topic_centroid_on_feedback_save",
    )
    list_filter = ("recompute_topic_centroid_on_feedback_save",)
    fields = (
        "project",
        "draft_schedule_cron",
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
        "recompute_topic_centroid_on_feedback_save",
    )

    @admin.action(description="Recompute source quality and authority")
    def recompute_selected_authority_models(self, request, queryset):
        """Trigger source-quality and authority recomputes for selected projects."""

        from core.tasks import recompute_authority_scores, recompute_source_quality

        selected_count = 0
        for config in queryset.select_related("project"):
            project_id = int(config.project_id)
            if settings.CELERY_TASK_ALWAYS_EAGER:
                recompute_source_quality(project_id)
                recompute_authority_scores(project_id)
            else:
                recompute_source_quality.delay(project_id)
                recompute_authority_scores.delay(project_id)
            selected_count += 1
        if selected_count:
            self.message_user(
                request,
                (
                    "Queued source-quality and authority recomputation for "
                    f"{selected_count} project config(s)."
                ),
                messages.SUCCESS,
            )


@admin.register(SourceConfig)
class SourceConfigAdmin(ModelAdmin):
    """Admin view for source-plugin configuration and connectivity checks."""

    list_display = (
        "plugin_name",
        "project",
        "display_health",
        "is_active",
        "last_fetched_at",
    )
    list_filter = (
        "is_active",
        "plugin_name",
        ("project", admin.RelatedOnlyFieldListFilter),
    )
    list_editable = ("is_active",)
    search_fields = ("plugin_name", "project__name")
    actions = ["test_source_connection"]
    readonly_fields = ("last_fetched_at", "pretty_config")
    fieldsets = (
        ("Core Settings", {"fields": ("plugin_name", "project", "is_active")}),
        ("Configuration", {"fields": ("pretty_config", "config")}),
        ("Activity", {"fields": ("last_fetched_at",)}),
    )

    @admin.display(description="Status")
    def display_health(self, obj):
        """Infer a human-friendly health state from activity timestamps."""

        if not obj.is_active:
            return format_html('<span style="color: {};">{}</span>', "gray", "● Paused")

        if obj.last_fetched_at:
            hours_since = (timezone.now() - obj.last_fetched_at).total_seconds() / 3600
            if hours_since > 24:
                return format_html(
                    '<span style="color: {};">{}</span>', "red", "● Stale"
                )
            return format_html(
                '<span style="color: {};">{}</span>', "green", "● Healthy"
            )

        return format_html(
            '<span style="color: {};">{}</span>', "orange", "● Never Run"
        )

    @admin.display(description="Config Preview")
    def pretty_config(self, obj):
        """Display the JSON config in a readable format."""

        if not obj.config:
            return "Empty"
        formatted_json = json.dumps(obj.config, indent=4)
        return mark_safe(
            f'<pre style="background: #1e1e1e; color: #dcdcdc; padding: 10px; border-radius: 5px; font-size: 12px;">{formatted_json}</pre>'
        )

    @admin.action(description="Test Source Connectivity")
    def test_source_connection(self, request, queryset):
        """Trigger a dry-run connectivity check for the selected sources."""

        healthy_sources = []
        failed_sources = []

        for source_config in queryset.select_related("project"):
            try:
                source_config.config = validate_plugin_config(
                    source_config.plugin_name,
                    source_config.config,
                )
                plugin = get_plugin_for_source_config(source_config)
                if not plugin.health_check():
                    raise RuntimeError("Health check returned an unhealthy status.")
            except Exception as exc:
                failed_sources.append(f"{source_config}: {exc}")
            else:
                healthy_sources.append(str(source_config))

        if healthy_sources:
            self.message_user(
                request,
                f"Connectivity check passed for {len(healthy_sources)} source(s).",
                messages.SUCCESS,
            )

        if failed_sources:
            self.message_user(
                request,
                "Connectivity check failed for: " + "; ".join(failed_sources),
                messages.ERROR,
            )

    def changelist_view(self, request, extra_context=None):
        """Augment the changelist with source-count and diversity stats."""

        qs = self.get_queryset(request)
        extra_context = cast(dict[str, Any], extra_context or {})
        active_count = qs.filter(is_active=True).count()
        total_count = qs.count() or 1

        extra_context["dashboard_stats"] = [
            {
                "title": "Active Sources",
                "value": f"{active_count} / {total_count}",
                "icon": "settings_input_component",
                "color": "success" if active_count == total_count else "warning",
            },
            {
                "title": "Plugin Variety",
                "value": qs.values("plugin_name").distinct().count(),
                "icon": "extension",
            },
        ]
        return super().changelist_view(request, extra_context=extra_context)
