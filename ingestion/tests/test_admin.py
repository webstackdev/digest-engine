from datetime import timedelta
from types import SimpleNamespace
from typing import Any, cast

import pytest
from django.contrib.admin.sites import AdminSite
from django.http import HttpRequest
from django.test import RequestFactory
from django.utils import timezone

from ingestion.admin import IngestionRunAdmin
from ingestion.models import IngestionRun, RunStatus
from projects.model_support import SourcePluginName
from projects.models import Project

pytestmark = pytest.mark.django_db


def _create_user(user_model: Any, **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


def _request(query_params: dict[str, str] | None = None) -> HttpRequest:
    """Build a typed request object for admin actions and filters."""

    return RequestFactory().get("/admin/", data=query_params or {})


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


def test_ingestion_run_display_efficiency_renders_without_django6_format_error(
    source_admin_context,
):
    run = IngestionRun.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        status=RunStatus.SUCCESS,
        items_fetched=12,
        items_ingested=9,
    )
    admin_instance = IngestionRunAdmin(IngestionRun, AdminSite())

    rendered = admin_instance.display_efficiency(run)

    assert "75%" in rendered


def test_ingestion_run_display_duration_handles_running_and_completed(
    source_admin_context,
):
    running_run = IngestionRun.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        status=RunStatus.RUNNING,
        items_fetched=0,
        items_ingested=0,
    )
    completed_run = IngestionRun.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        status=RunStatus.SUCCESS,
        items_fetched=10,
        items_ingested=10,
    )
    completed_run.started_at = timezone.now() - timedelta(minutes=3, seconds=5)
    completed_run.completed_at = completed_run.started_at + timedelta(
        minutes=3, seconds=5
    )
    completed_run.save(update_fields=["started_at", "completed_at"])
    admin_instance = IngestionRunAdmin(IngestionRun, AdminSite())

    assert admin_instance.display_duration(running_run) == "In Progress..."
    assert admin_instance.display_duration(completed_run) == "3m 5s"


def test_ingestion_run_admin_status_efficiency_and_dashboard_branches(
    source_admin_context, mocker
):
    IngestionRun.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        status="failed",
        items_fetched=0,
        items_ingested=0,
    )
    running_run = IngestionRun.objects.create(
        project=source_admin_context.project,
        plugin_name=SourcePluginName.RSS,
        status=RunStatus.RUNNING,
        items_fetched=5,
        items_ingested=5,
    )
    admin_instance = IngestionRunAdmin(IngestionRun, AdminSite())
    super_changelist_view = mocker.patch(
        "ingestion.admin.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )

    response = admin_instance.changelist_view(_request())
    dashboard_stats = _dashboard_stats(response)

    assert "danger" in admin_instance.display_status(
        IngestionRun.objects.filter(status="failed").first()
    )
    assert (
        admin_instance.display_efficiency(
            IngestionRun.objects.filter(status="failed").first()
        )
        == "0/0"
    )
    assert "info" in admin_instance.display_status(running_run)
    super_changelist_view.assert_called_once()
    assert dashboard_stats[0]["value"] == "5"
    assert dashboard_stats[1]["color"] == "warning"
