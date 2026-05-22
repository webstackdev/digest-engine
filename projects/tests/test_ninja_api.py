from http import HTTPStatus
from typing import Any, cast
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.test import TestCase
from django.urls import reverse

from projects.models import (
    BlueskyCredentials,
    LinkedInCredentials,
    MastodonCredentials,
    Project,
    ProjectMembership,
    ProjectRole,
)


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed API test assertions."""
    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _create_user(user_model: type[Any], **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""
    return cast(Any, user_model.objects).create_user(**kwargs)


class ProjectNinjaApiTests(TestCase):
    """Exercise project-owned Ninja API endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.other_user = _create_user(
            user_model, username="other", password="testpass123"
        )
        self.owner_project = Project.objects.create(
            name="Owner Project",
            topic_description="Platform engineering",
        )
        self.other_project = Project.objects.create(
            name="Other Project",
            topic_description="Frontend",
        )
        ProjectMembership.objects.create(
            user=self.owner,
            project=self.owner_project,
            role=ProjectRole.ADMIN,
        )
        ProjectMembership.objects.create(
            user=self.other_user,
            project=self.other_project,
            role=ProjectRole.ADMIN,
        )
        self.client.force_login(self.owner)

    def test_project_list_requires_authentication(self):
        self.client.logout()
        response = self.client.get(
            reverse("ninja-api:list_projects"), HTTP_HOST="localhost"
        )
        self.assertEqual(response.status_code, HTTPStatus.UNAUTHORIZED)
        self.assertEqual(
            response.json(),
            {"detail": "Unauthorized"},
        )

    def test_project_list_is_scoped_to_request_user_memberships(self):
        BlueskyCredentials.objects.create(
            project=self.owner_project,
            handle="owner-project.bsky.social",
            is_active=True,
            last_error="",
        )

        response = self.client.get(reverse("ninja-api:list_projects"))

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(self.owner_project))
        self.assertEqual(response.json()[0]["user_role"], ProjectRole.ADMIN)
        self.assertEqual(
            response.json()[0]["intake_token"], self.owner_project.intake_token
        )
        self.assertFalse(response.json()[0]["intake_enabled"])
        self.assertTrue(response.json()[0]["has_bluesky_credentials"])
        self.assertEqual(
            response.json()[0]["bluesky_handle"], "owner-project.bsky.social"
        )
        self.assertTrue(response.json()[0]["bluesky_is_active"])
        self.assertEqual(response.json()[0]["bluesky_last_error"], "")

    def test_canonical_v1_project_list_uses_ninja_router(self):
        response = self.client.get("/api/v1/projects/")

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], _require_pk(self.owner_project))

    def test_create_and_update_project_use_native_validation_and_payload_shape(self):
        create_response = self.client.post(
            reverse("ninja-api:create_project"),
            {
                "name": "New Project",
                "topic_description": "AI workflows",
                "content_retention_days": 120,
                "intake_enabled": True,
            },
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, HTTPStatus.CREATED)
        created_project = Project.objects.get(name="New Project")
        self.assertEqual(create_response.json()["id"], _require_pk(created_project))
        self.assertEqual(create_response.json()["user_role"], ProjectRole.ADMIN)
        self.assertTrue(create_response.json()["intake_enabled"])
        self.assertEqual(created_project.content_retention_days, 120)
        self.assertTrue(
            ProjectMembership.objects.filter(
                project=created_project,
                user=self.owner,
                role=ProjectRole.ADMIN,
            ).exists()
        )

        update_response = self.client.patch(
            reverse(
                "ninja-api:update_project",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "name": "Updated Owner Project",
                "content_retention_days": 30,
                "intake_enabled": True,
            },
            content_type="application/json",
        )

        self.owner_project.refresh_from_db()
        self.assertEqual(update_response.status_code, HTTPStatus.OK)
        self.assertEqual(self.owner_project.name, "Updated Owner Project")
        self.assertEqual(self.owner_project.content_retention_days, 30)
        self.assertTrue(self.owner_project.intake_enabled)
        self.assertEqual(update_response.json()["name"], "Updated Owner Project")
        self.assertTrue(update_response.json()["intake_enabled"])

    def test_project_create_and_update_reject_invalid_native_payloads(self):
        create_response = self.client.post(
            reverse("ninja-api:create_project"),
            {
                "name": "   ",
                "topic_description": "",
                "content_retention_days": -1,
            },
            content_type="application/json",
        )
        update_response = self.client.patch(
            reverse(
                "ninja-api:update_project",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "content_retention_days": -5,
            },
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(
            create_response.json()["name"][0], "This field may not be blank."
        )
        self.assertEqual(
            create_response.json()["topic_description"][0],
            "This field may not be blank.",
        )
        self.assertEqual(
            create_response.json()["content_retention_days"][0],
            "Ensure this value is greater than or equal to 0.",
        )
        self.assertEqual(update_response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(
            update_response.json()["content_retention_days"][0],
            "Ensure this value is greater than or equal to 0.",
        )

    def test_project_rotate_intake_token_returns_updated_project(self):
        original_token = self.owner_project.intake_token

        response = self.client.post(
            reverse(
                "ninja-api:rotate_intake_token",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            content_type="application/json",
        )

        self.owner_project.refresh_from_db()
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertNotEqual(self.owner_project.intake_token, original_token)
        self.assertEqual(
            response.json()["intake_token"], self.owner_project.intake_token
        )

    def test_verify_bluesky_credentials_requires_project_credentials(self):
        response = self.client.post(
            reverse(
                "ninja-api:verify_bluesky_credentials",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)

    @patch("ingestion.plugins.bluesky.BlueskySourcePlugin.verify_credentials")
    def test_verify_bluesky_credentials_verifies_project_account(self, verify_mock):
        credentials = BlueskyCredentials(
            project=self.owner_project, handle="project.bsky.social"
        )
        credentials.set_app_password("app-password")
        credentials.save()

        response = self.client.post(
            reverse(
                "ninja-api:verify_bluesky_credentials",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        verify_mock.assert_called_once()
        verified_credentials = verify_mock.call_args.args[0]
        self.assertEqual(verified_credentials, credentials)
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["handle"], "project.bsky.social")
        self.assertEqual(response.json()["last_error"], "")

    @patch("projects.ninja_api.logger.exception")
    @patch(
        "ingestion.plugins.bluesky.BlueskySourcePlugin.verify_credentials",
        side_effect=RuntimeError("bad login"),
    )
    def test_verify_bluesky_credentials_surfaces_verification_errors(
        self, _verify_mock, logger_exception_mock
    ):
        credentials = BlueskyCredentials(
            project=self.owner_project, handle="project.bsky.social"
        )
        credentials.set_app_password("app-password")
        credentials.save()

        response = self.client.post(
            reverse(
                "ninja-api:verify_bluesky_credentials",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertNotIn("bad login", str(response.json()))
        logger_exception_mock.assert_called_once_with(
            "Bluesky credential verification failed for project id=%s",
            _require_pk(self.owner_project),
        )

    def test_verify_mastodon_credentials_requires_configured_project_credentials(self):
        response = self.client.post(
            reverse(
                "ninja-api:verify_mastodon_credentials",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)

    @patch("ingestion.plugins.mastodon.MastodonSourcePlugin.verify_credentials")
    def test_verify_mastodon_credentials_verifies_project_account(self, verify_mock):
        credentials = MastodonCredentials(
            project=self.owner_project,
            account_acct="test@mastodon.social",
            instance_url="https://mastodon.social",
        )
        credentials.set_access_token("access-token")
        credentials.save()

        response = self.client.post(
            reverse(
                "ninja-api:verify_mastodon_credentials",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        verify_mock.assert_called_once()
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["account_acct"], "test@mastodon.social")
        self.assertEqual(response.json()["instance_url"], "https://mastodon.social")

    def test_verify_linkedin_credentials_requires_configured_project_credentials(self):
        response = self.client.post(
            reverse(
                "ninja-api:verify_linkedin_credentials",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)

    @patch("ingestion.plugins.linkedin.LinkedInSourcePlugin.verify_credentials")
    def test_verify_linkedin_credentials_verifies_project_account(self, verify_mock):
        credentials = LinkedInCredentials(
            project=self.owner_project, member_urn="urn:li:person:123"
        )
        credentials.set_access_token("access-token")
        credentials.set_refresh_token("refresh-token")
        credentials.save()

        response = self.client.post(
            reverse(
                "ninja-api:verify_linkedin_credentials",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        verify_mock.assert_called_once()
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["member_urn"], "urn:li:person:123")

    @patch("projects.ninja_api.build_linkedin_authorize_url")
    def test_start_linkedin_oauth_returns_authorize_url(self, build_authorize_url_mock):
        build_authorize_url_mock.return_value = (
            "https://www.linkedin.com/oauth/v2/authorization?test=1"
        )

        response = self.client.post(
            reverse(
                "ninja-api:start_linkedin_oauth",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"redirect_to": "http://localhost:3000/callback"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(
            response.json()["authorize_url"],
            "https://www.linkedin.com/oauth/v2/authorization?test=1",
        )
        build_authorize_url_mock.assert_called_once_with(
            self.owner_project, "http://localhost:3000/callback"
        )
