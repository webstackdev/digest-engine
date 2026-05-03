from types import SimpleNamespace
from typing import Any, cast

import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from newsletters.admin import IntakeAllowlistAdmin, NewsletterIntakeAdmin
from newsletters.models import IntakeAllowlist, NewsletterIntake, NewsletterIntakeStatus
from projects.models import Project

pytestmark = pytest.mark.django_db


def _create_user(user_model: Any, **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


def _request():
    """Build a typed request object for admin actions and filters."""

    return RequestFactory().get("/admin/")


@pytest.fixture
def newsletter_admin_context(django_user_model):
    user = _create_user(
        django_user_model, username="newsletter-admin", password="testpass123"
    )
    project = Project.objects.create(name="Newsletter Admin", topic_description="DX")
    return SimpleNamespace(user=user, project=project)


def test_intake_allowlist_admin_renders_confirmation_state(newsletter_admin_context):
    allowlist = IntakeAllowlist.objects.create(
        project=newsletter_admin_context.project,
        sender_email="sender@example.com",
    )
    admin_instance = IntakeAllowlistAdmin(IntakeAllowlist, AdminSite())

    assert "PENDING" in admin_instance.confirmation_state(allowlist)
    allowlist.confirmed_at = "2026-05-01T00:00:00Z"
    allowlist.save(update_fields=["confirmed_at"])

    assert "CONFIRMED" in admin_instance.confirmation_state(allowlist)


def test_newsletter_intake_admin_pretty_result_and_dashboard(
    newsletter_admin_context, mocker
):
    NewsletterIntake.objects.create(
        project=newsletter_admin_context.project,
        sender_email="sender@example.com",
        subject="Pending Digest",
        raw_text="Pending body",
        message_id="pending-msg",
        status=NewsletterIntakeStatus.PENDING,
    )
    intake = NewsletterIntake.objects.create(
        project=newsletter_admin_context.project,
        sender_email="sender@example.com",
        subject="Extracted Digest",
        raw_text="Extracted body",
        message_id="extracted-msg",
        status=NewsletterIntakeStatus.EXTRACTED,
        extraction_result={"method": "openrouter", "items_extracted": 1},
    )
    NewsletterIntake.objects.create(
        project=newsletter_admin_context.project,
        sender_email="sender@example.com",
        subject="Failed Digest",
        raw_text="Failed body",
        message_id="failed-msg",
        status=NewsletterIntakeStatus.FAILED,
        error_message="provider timeout",
    )

    admin_instance = NewsletterIntakeAdmin(NewsletterIntake, AdminSite())
    super_changelist_view = mocker.patch(
        "newsletters.admin.ModelAdmin.changelist_view",
        side_effect=lambda request, extra_context=None: extra_context,
    )

    rendered_json = admin_instance.pretty_extraction_result(intake)
    response = admin_instance.changelist_view(_request())

    assert "openrouter" in rendered_json
    assert "EXTRACTED" in admin_instance.display_status(intake)
    assert response["dashboard_stats"][0]["value"] == "3"
    assert response["dashboard_stats"][2]["value"] == "1"
    super_changelist_view.assert_called_once()
