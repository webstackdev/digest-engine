from datetime import timedelta
from types import SimpleNamespace
from typing import Any, cast

import pytest
from django.contrib.admin.sites import AdminSite
from django.db.models import Model
from django.http import HttpRequest
from django.test import RequestFactory
from django.utils import timezone

from projects.models import Project
from trends.admin import TopicCentroidSnapshotAdmin
from trends.models import TopicCentroidSnapshot

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


def _context(response: object) -> dict[str, Any]:
    """Cast admin changelist extra_context payloads for typed assertions."""

    return cast(dict[str, Any], response)


def _dashboard_stats(response: object) -> list[dict[str, Any]]:
    """Return typed dashboard stats rows from a changelist extra_context payload."""

    return cast(list[dict[str, Any]], _context(response)["dashboard_stats"])


def _drilldowns(response: object) -> list[dict[str, Any]]:
    """Return typed centroid drilldowns from a changelist extra_context payload."""

    return cast(list[dict[str, Any]], _context(response)["centroid_project_drilldowns"])


@pytest.fixture
def source_admin_context(django_user_model):
    user = _create_user(
        django_user_model,
        username="admin-owner",
        password="testpass123",
    )
    project = Project.objects.create(name="Admin Project", topic_description="Infra")
    return SimpleNamespace(user=user, project=project)


def test_topic_centroid_snapshot_admin_renders_drift_fields(source_admin_context):
    snapshot = TopicCentroidSnapshot.objects.create(
        project=source_admin_context.project,
        centroid_active=True,
        centroid_vector=[1.0, 0.0],
        feedback_count=15,
        upvote_count=12,
        downvote_count=3,
        drift_from_previous=0.125,
        drift_from_week_ago=0.4,
    )
    admin_instance = TopicCentroidSnapshotAdmin(TopicCentroidSnapshot, AdminSite())

    assert admin_instance.display_drift_from_previous(snapshot) == "12.5%"
    assert admin_instance.display_drift_from_week_ago(snapshot) == "40.0%"


def test_topic_centroid_snapshot_admin_changelist_view_builds_dashboard_stats(
    source_admin_context, mocker
):
    second_project = Project.objects.create(
        name="Second Admin Project",
        topic_description="Analytics",
    )
    fixed_now = timezone.now()
    recent_snapshot = TopicCentroidSnapshot.objects.create(
        project=source_admin_context.project,
        centroid_active=True,
        centroid_vector=[1.0, 0.0],
        feedback_count=18,
        upvote_count=14,
        downvote_count=4,
        drift_from_previous=0.1,
        drift_from_week_ago=0.2,
    )
    stale_snapshot = TopicCentroidSnapshot.objects.create(
        project=second_project,
        centroid_active=False,
        centroid_vector=[],
        feedback_count=2,
        upvote_count=1,
        downvote_count=1,
    )
    TopicCentroidSnapshot.objects.filter(pk=recent_snapshot.pk).update(
        computed_at=fixed_now - timedelta(hours=6)
    )
    TopicCentroidSnapshot.objects.filter(pk=stale_snapshot.pk).update(
        computed_at=fixed_now - timedelta(days=2)
    )
    admin_instance = TopicCentroidSnapshotAdmin(TopicCentroidSnapshot, AdminSite())
    mocker.patch.object(
        admin_instance,
        "get_queryset",
        return_value=TopicCentroidSnapshot.objects.all(),
    )
    super_changelist_view = mocker.patch(
        "django.contrib.admin.options.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )
    mocker.patch("trends.admin.timezone.now", return_value=fixed_now)

    response = admin_instance.changelist_view(request=_request())
    dashboard_stats = _dashboard_stats(response)
    centroid_project_drilldowns = _drilldowns(response)

    super_changelist_view.assert_called_once()
    assert (
        admin_instance.list_before_template
        == "admin/topic_centroid_snapshot_changelist_widget.html"
    )
    assert dashboard_stats[0]["value"] == "1 / 2"
    assert dashboard_stats[0]["color"] == "warning"
    assert dashboard_stats[1]["value"] == "10.0%"
    assert dashboard_stats[1]["color"] == "success"
    assert dashboard_stats[2]["value"] == "20.0%"
    assert dashboard_stats[2]["color"] == "warning"
    assert dashboard_stats[3]["value"] == "6h ago"
    assert dashboard_stats[3]["color"] == "success"
    assert len(centroid_project_drilldowns) == 2
    assert centroid_project_drilldowns[0]["project_name"] == "Admin Project"
    assert centroid_project_drilldowns[0]["href"] == (
        "/admin/trends/topiccentroidsnapshot/?project__id__exact="
        f"{_require_pk(source_admin_context.project)}"
    )
    assert centroid_project_drilldowns[0]["drift_from_previous"] == "10.0%"
