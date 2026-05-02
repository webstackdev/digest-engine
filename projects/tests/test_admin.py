from datetime import timedelta
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import ANY, Mock

import pytest
from django.contrib import messages
from django.contrib.admin.sites import AdminSite
from django.db.models import Model
from django.http import HttpRequest
from django.test import RequestFactory
from django.utils import timezone

from projects.admin import (
    BlueskyCredentialsAdmin,
    BlueskyCredentialsAdminForm,
    LinkedInCredentialsAdmin,
    LinkedInCredentialsAdminForm,
    MastodonCredentialsAdmin,
    MastodonCredentialsAdminForm,
    ProjectConfigAdmin,
    SourceConfigAdmin,
)
from projects.model_support import SourcePluginName
from projects.models import (
    BlueskyCredentials,
    LinkedInCredentials,
    MastodonCredentials,
    Project,
    ProjectConfig,
    SourceConfig,
)

pytestmark = pytest.mark.django_db


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed admin test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _create_user(user_model: Any, **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


def _request(query_params: dict[str, str] | None = None) -> HttpRequest:
    """Build a typed request object for admin actions and filters."""

    return RequestFactory().get("/admin/", data=query_params or {})


def _message_user_mock(admin_instance: Any, mocker: Any) -> Mock:
    """Install a mock for ModelAdmin.message_user and return it for assertions."""

    message_mock = cast(Mock, mocker.Mock())
    admin_instance.message_user = message_mock
    return message_mock


def _context(response: object) -> dict[str, Any]:
    """Cast admin changelist extra_context payloads for typed assertions."""

    return cast(dict[str, Any], response)


def _dashboard_stats(response: object) -> list[dict[str, Any]]:
    """Return typed dashboard stats rows from a changelist extra_context payload."""

    return cast(list[dict[str, Any]], _context(response)["dashboard_stats"])


@pytest.fixture
def source_admin_context(django_user_model):
    user = _create_user(
        django_user_model, username="admin-owner", password="testpass123"
    )
    project = Project.objects.create(name="Admin Project", topic_description="Infra")
    return SimpleNamespace(user=user, project=project)


def test_test_source_connection_reports_success(source_admin_context, mocker):
    source_config = SourceConfig.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    plugin = mocker.Mock()
    plugin.health_check.return_value = True
    validate_mock = mocker.patch(
        "projects.admin.validate_plugin_config",
        return_value={"feed_url": "https://example.com/feed.xml"},
    )
    get_plugin_mock = mocker.patch(
        "projects.admin.get_plugin_for_source_config", return_value=plugin
    )
    admin_instance = SourceConfigAdmin(SourceConfig, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.test_source_connection(
        request=_request(),
        queryset=SourceConfig.objects.filter(pk=source_config.pk),
    )

    validate_mock.assert_called_once_with(
        SourcePluginName.RSS, {"feed_url": "https://example.com/feed.xml"}
    )
    get_plugin_mock.assert_called_once()
    plugin.health_check.assert_called_once_with()
    message_user_mock.assert_called_once_with(
        ANY,
        "Connectivity check passed for 1 source(s).",
        messages.SUCCESS,
    )


def test_project_config_admin_exposes_centroid_toggle_field(source_admin_context):
    config = ProjectConfig.objects.create(project=source_admin_context.project)
    admin_instance = ProjectConfigAdmin(ProjectConfig, AdminSite())

    assert "recompute_topic_centroid_on_feedback_save" in admin_instance.list_display
    assert "recompute_topic_centroid_on_feedback_save" in admin_instance.list_filter
    assert "recompute_topic_centroid_on_feedback_save" in admin_instance.get_fields(
        request=_request(), obj=config
    )


def test_test_source_connection_reports_failures(source_admin_context, mocker):
    source_config = SourceConfig.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
    )
    mocker.patch(
        "projects.admin.validate_plugin_config",
        side_effect=ValueError("Missing required config field: feed_url"),
    )
    admin_instance = SourceConfigAdmin(SourceConfig, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.test_source_connection(
        request=_request(),
        queryset=SourceConfig.objects.filter(pk=source_config.pk),
    )

    message_user_mock.assert_called_once_with(
        ANY,
        "Connectivity check failed for: rss source for Admin Project: Missing required config field: feed_url",
        messages.ERROR,
    )


def test_source_config_display_health_renders_without_django6_format_html_error(
    source_admin_context,
):
    source_config = SourceConfig.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/feed.xml"},
        is_active=True,
        last_fetched_at=timezone.now(),
    )
    admin_instance = SourceConfigAdmin(SourceConfig, AdminSite())

    rendered = admin_instance.display_health(source_config)

    assert "Healthy" in rendered


def test_bluesky_credentials_admin_form_encrypts_app_password(source_admin_context):
    form = BlueskyCredentialsAdminForm(
        data={
            "project": _require_pk(source_admin_context.project),
            "handle": "@Alice.BSKY.social",
            "credential_input": "app-password",
            "pds_url": "https://pds.example.com/xrpc/",
            "is_active": True,
        }
    )

    assert form.is_valid(), form.errors
    credentials = form.save()

    assert credentials.handle == "alice.bsky.social"
    assert credentials.pds_url == "https://pds.example.com"
    assert credentials.has_app_password() is True
    assert credentials.get_app_password() == "app-password"


def test_verify_selected_bluesky_credentials_reports_success(
    source_admin_context, mocker
):
    credentials = BlueskyCredentials.objects.create(
        project=source_admin_context.project,
        handle="alice.bsky.social",
        app_password_encrypted="ciphertext",
    )
    verify_mock = mocker.patch(
        "ingestion.plugins.bluesky.BlueskySourcePlugin.verify_credentials"
    )
    admin_instance = BlueskyCredentialsAdmin(BlueskyCredentials, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.verify_selected_credentials(
        request=_request(),
        queryset=BlueskyCredentials.objects.filter(pk=credentials.pk),
    )

    verify_mock.assert_called_once_with(credentials)
    message_user_mock.assert_called_once_with(
        ANY,
        "Credential verification passed for 1 account(s).",
        messages.SUCCESS,
    )


def test_verify_selected_bluesky_credentials_reports_failures(
    source_admin_context, mocker
):
    credentials = BlueskyCredentials.objects.create(
        project=source_admin_context.project,
        handle="alice.bsky.social",
        app_password_encrypted="ciphertext",
    )
    mocker.patch(
        "ingestion.plugins.bluesky.BlueskySourcePlugin.verify_credentials",
        side_effect=RuntimeError("bad login"),
    )
    admin_instance = BlueskyCredentialsAdmin(BlueskyCredentials, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.verify_selected_credentials(
        request=_request(),
        queryset=BlueskyCredentials.objects.filter(pk=credentials.pk),
    )

    message_user_mock.assert_called_once_with(
        ANY,
        "Credential verification failed for: Bluesky credentials for Admin Project: bad login",
        messages.ERROR,
    )


def test_mastodon_credentials_admin_form_encrypts_access_token(source_admin_context):
    form = MastodonCredentialsAdminForm(
        data={
            "project": _require_pk(source_admin_context.project),
            "instance_url": "https://hachyderm.io/@alice/",
            "account_acct": "@Alice",
            "credential_input": "access-token",
            "is_active": True,
        }
    )

    assert form.is_valid(), form.errors
    credentials = form.save()

    assert credentials.instance_url == "https://hachyderm.io"
    assert credentials.account_acct == "alice@hachyderm.io"
    assert credentials.has_access_token() is True
    assert credentials.get_access_token() == "access-token"


def test_verify_selected_mastodon_credentials_reports_success(
    source_admin_context, mocker
):
    credentials = MastodonCredentials.objects.create(
        project=source_admin_context.project,
        instance_url="https://hachyderm.io",
        account_acct="alice@hachyderm.io",
        access_token_encrypted="ciphertext",
    )
    verify_mock = mocker.patch(
        "ingestion.plugins.mastodon.MastodonSourcePlugin.verify_credentials"
    )
    admin_instance = MastodonCredentialsAdmin(MastodonCredentials, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.verify_selected_credentials(
        request=_request(),
        queryset=MastodonCredentials.objects.filter(pk=credentials.pk),
    )

    verify_mock.assert_called_once_with(credentials)
    message_user_mock.assert_called_once_with(
        ANY,
        "Credential verification passed for 1 account(s).",
        messages.SUCCESS,
    )


def test_verify_selected_mastodon_credentials_reports_failures(
    source_admin_context, mocker
):
    credentials = MastodonCredentials.objects.create(
        project=source_admin_context.project,
        instance_url="https://hachyderm.io",
        account_acct="alice@hachyderm.io",
        access_token_encrypted="ciphertext",
    )
    mocker.patch(
        "ingestion.plugins.mastodon.MastodonSourcePlugin.verify_credentials",
        side_effect=RuntimeError("bad token"),
    )
    admin_instance = MastodonCredentialsAdmin(MastodonCredentials, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.verify_selected_credentials(
        request=_request(),
        queryset=MastodonCredentials.objects.filter(pk=credentials.pk),
    )

    message_user_mock.assert_called_once_with(
        ANY,
        "Credential verification failed for: Mastodon credentials for Admin Project: bad token",
        messages.ERROR,
    )


def test_linkedin_credentials_admin_form_encrypts_oauth_tokens(source_admin_context):
    form = LinkedInCredentialsAdminForm(
        data={
            "project": _require_pk(source_admin_context.project),
            "member_urn": "urn:li:person:abc123",
            "expires_at": "2026-04-27 13:00:00+00:00",
            "access_token_input": "access-token",
            "refresh_token_input": "refresh-token",
            "is_active": True,
        }
    )

    assert form.is_valid(), form.errors
    credentials = form.save()

    assert credentials.member_urn == "urn:li:person:abc123"
    assert credentials.get_access_token() == "access-token"
    assert credentials.get_refresh_token() == "refresh-token"


def test_verify_selected_linkedin_credentials_reports_success(
    source_admin_context, mocker
):
    credentials = LinkedInCredentials.objects.create(
        project=source_admin_context.project,
        member_urn="urn:li:person:abc123",
        access_token_encrypted="ciphertext",
        refresh_token_encrypted="ciphertext",
    )
    verify_mock = mocker.patch(
        "ingestion.plugins.linkedin.LinkedInSourcePlugin.verify_credentials"
    )
    admin_instance = LinkedInCredentialsAdmin(LinkedInCredentials, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.verify_selected_credentials(
        request=_request(),
        queryset=LinkedInCredentials.objects.filter(pk=credentials.pk),
    )

    verify_mock.assert_called_once_with(credentials)
    message_user_mock.assert_called_once_with(
        ANY,
        "Credential verification passed for 1 account(s).",
        messages.SUCCESS,
    )


def test_verify_selected_linkedin_credentials_reports_failures(
    source_admin_context, mocker
):
    credentials = LinkedInCredentials.objects.create(
        project=source_admin_context.project,
        member_urn="urn:li:person:abc123",
        access_token_encrypted="ciphertext",
        refresh_token_encrypted="ciphertext",
    )
    mocker.patch(
        "ingestion.plugins.linkedin.LinkedInSourcePlugin.verify_credentials",
        side_effect=RuntimeError("bad token"),
    )
    admin_instance = LinkedInCredentialsAdmin(LinkedInCredentials, AdminSite())
    message_user_mock = _message_user_mock(admin_instance, mocker)

    admin_instance.verify_selected_credentials(
        request=_request(),
        queryset=LinkedInCredentials.objects.filter(pk=credentials.pk),
    )

    message_user_mock.assert_called_once_with(
        ANY,
        "Credential verification failed for: LinkedIn credentials for Admin Project: bad token",
        messages.ERROR,
    )


def test_source_config_admin_health_pretty_config_and_dashboard_branches(
    source_admin_context, mocker
):
    stale_config = SourceConfig.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={"feed_url": "https://example.com/stale.xml"},
        is_active=True,
        last_fetched_at=timezone.now() - timedelta(days=2),
    )
    paused_config = SourceConfig.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.REDDIT,
        config={},
        is_active=False,
    )
    never_run_config = SourceConfig.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        config={},
        is_active=True,
        last_fetched_at=None,
    )
    admin_instance = SourceConfigAdmin(SourceConfig, AdminSite())
    super_changelist_view = mocker.patch(
        "projects.admin.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )

    response = admin_instance.changelist_view(_request())
    dashboard_stats = _dashboard_stats(response)

    assert "Stale" in admin_instance.display_health(stale_config)
    assert "Paused" in admin_instance.display_health(paused_config)
    assert "Never Run" in admin_instance.display_health(never_run_config)
    assert admin_instance.pretty_config(paused_config) == "Empty"
    super_changelist_view.assert_called_once()
    assert dashboard_stats[0]["color"] == "warning"
    assert dashboard_stats[1]["value"] == 2
