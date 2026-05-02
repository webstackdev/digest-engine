from typing import Any, cast
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from projects.linkedin_oauth import (
    build_linkedin_authorize_url,
    build_linkedin_oauth_state,
)
from projects.model_support import SourcePluginName
from projects.models import (
    BlueskyCredentials,
    LinkedInCredentials,
    MastodonCredentials,
    Project,
    ProjectConfig,
    ProjectMembership,
    ProjectRole,
)


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed API test assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _typed_client(client: object) -> APIClient:
    """Cast the DRF test client so Pylance sees APIClient helpers."""

    return cast(APIClient, client)


def _create_user(user_model: type[Any], **kwargs: object):
    """Create a user through the custom manager with a typed escape hatch."""

    return cast(Any, user_model.objects).create_user(**kwargs)


class ProjectApiTests(APITestCase):
    """Exercise project-owned project and credential API endpoints."""

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
        _typed_client(self.client).force_authenticate(self.owner)

    def assert_standardized_validation_error(
        self, payload: dict[str, object], attr: str
    ):
        """Assert the repo-standardized validation payload shape."""

        self.assertEqual(payload["type"], "validation_error")
        errors = cast(list[dict[str, object]], payload["errors"])
        self.assertTrue(any(error["attr"] == attr for error in errors))

    def test_project_list_requires_authentication(self):
        _typed_client(self.client).force_authenticate(user=None)

        response = self.client.get(reverse("v1:project-list"), HTTP_HOST="localhost")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.json(),
            {
                "type": "client_error",
                "errors": [
                    {
                        "code": "not_authenticated",
                        "detail": "Authentication credentials were not provided.",
                        "attr": None,
                    }
                ],
            },
        )

    def test_project_list_is_scoped_to_request_user_memberships(self):
        BlueskyCredentials.objects.create(
            project=self.owner_project,
            handle="owner-project.bsky.social",
            is_active=True,
            last_error="",
        )

        response = self.client.get(reverse("v1:project-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
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

    def test_project_rotate_intake_token_returns_updated_project(self):
        original_token = self.owner_project.intake_token

        response = self.client.post(
            reverse(
                "v1:project-rotate-intake-token",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.owner_project.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(self.owner_project.intake_token, original_token)
        self.assertEqual(
            response.json()["intake_token"], self.owner_project.intake_token
        )

    def test_project_config_detail_exposes_multi_signal_authority_weights(self):
        config = ProjectConfig.objects.create(
            project=self.owner_project,
            draft_schedule_cron="0 9 * * *",
        )

        response = self.client.get(
            reverse(
                "v1:project-config-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(config),
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["draft_schedule_cron"], "0 9 * * *")
        self.assertEqual(response.json()["authority_weight_mention"], 0.2)
        self.assertEqual(response.json()["authority_weight_engagement"], 0.15)
        self.assertEqual(response.json()["authority_weight_cross_newsletter"], 0.2)

    def test_project_config_patch_updates_multi_signal_authority_weights(self):
        config = ProjectConfig.objects.create(project=self.owner_project)

        response = self.client.patch(
            reverse(
                "v1:project-config-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(config),
                },
            ),
            {
                "draft_schedule_cron": "15 7 * * 1",
                "authority_weight_engagement": 0.25,
                "authority_weight_source_quality": 0.3,
            },
            format="json",
        )

        config.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(config.draft_schedule_cron, "15 7 * * 1")
        self.assertEqual(config.authority_weight_engagement, 0.25)
        self.assertEqual(config.authority_weight_source_quality, 0.3)

    def test_project_config_patch_rejects_invalid_draft_schedule_cron(self):
        config = ProjectConfig.objects.create(project=self.owner_project)

        response = self.client.patch(
            reverse(
                "v1:project-config-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(config),
                },
            ),
            {"draft_schedule_cron": "not a cron"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(),
            "draft_schedule_cron",
        )

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    @patch("core.tasks.recompute_authority_scores")
    @patch("core.tasks.recompute_source_quality")
    def test_project_config_recompute_authority_runs_tasks_immediately(
        self,
        recompute_source_quality_mock,
        recompute_authority_scores_mock,
    ):
        config = ProjectConfig.objects.create(project=self.owner_project)

        response = self.client.post(
            reverse(
                "v1:project-config-recompute-authority",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(config),
                },
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "completed")
        self.assertEqual(response.json()["project_id"], _require_pk(self.owner_project))
        self.assertEqual(response.json()["config_id"], _require_pk(config))
        recompute_source_quality_mock.assert_called_once_with(
            _require_pk(self.owner_project)
        )
        recompute_authority_scores_mock.assert_called_once_with(
            _require_pk(self.owner_project)
        )

    def test_bluesky_credentials_list_create_and_update_hide_stored_password(self):
        list_response = self.client.get(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.json(), [])

        create_response = self.client.post(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "handle": "@Owner.Project.BSKY.social",
                "pds_url": "https://pds.example.com/xrpc/",
                "is_active": True,
                "app_password": "app-password",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        credentials = BlueskyCredentials.objects.get(project=self.owner_project)
        self.assertEqual(credentials.handle, "owner.project.bsky.social")
        self.assertEqual(credentials.pds_url, "https://pds.example.com")
        self.assertEqual(credentials.get_app_password(), "app-password")
        self.assertTrue(create_response.json()["has_stored_credential"])
        self.assertNotIn("app_password", create_response.json())

        update_response = self.client.patch(
            reverse(
                "v1:project-bluesky-credentials-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(credentials),
                },
            ),
            {
                "handle": "updated.bsky.social",
                "pds_url": "",
                "is_active": False,
            },
            format="json",
        )

        credentials.refresh_from_db()
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(credentials.handle, "updated.bsky.social")
        self.assertFalse(credentials.is_active)
        self.assertEqual(credentials.get_app_password(), "app-password")

    def test_bluesky_credentials_create_requires_app_password(self):
        response = self.client.post(
            reverse(
                "v1:project-bluesky-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "handle": "owner.bsky.social",
                "pds_url": "",
                "is_active": True,
                "app_password": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(response.json(), "app_password")

    def test_verify_bluesky_credentials_requires_project_credentials(self):
        response = self.client.post(
            reverse(
                "v1:project-verify-bluesky-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "bluesky_credentials"
        )

    @patch("ingestion.plugins.bluesky.BlueskySourcePlugin.verify_credentials")
    def test_verify_bluesky_credentials_verifies_project_account(self, verify_mock):
        credentials = BlueskyCredentials(
            project=self.owner_project, handle="project.bsky.social"
        )
        credentials.set_app_password("app-password")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-bluesky-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        verify_mock.assert_called_once()
        verified_credentials = verify_mock.call_args.args[0]
        self.assertEqual(verified_credentials, credentials)
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["handle"], "project.bsky.social")
        self.assertEqual(response.json()["last_error"], "")

    @patch("core.api.logger.exception")
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
                "v1:project-verify-bluesky-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "bluesky_credentials"
        )
        self.assertNotIn("bad login", str(response.json()))
        logger_exception_mock.assert_called_once_with(
            "Bluesky credential verification failed for project id=%s",
            _require_pk(self.owner_project),
        )

    def test_verify_mastodon_credentials_requires_configured_project_credentials(self):
        response = self.client.post(
            reverse(
                "v1:project-verify-mastodon-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "mastodon_credentials"
        )

    def test_linkedin_credentials_list_create_and_update_hide_stored_tokens(self):
        list_response = self.client.get(
            reverse(
                "v1:project-linkedin-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.json(), [])

        create_response = self.client.post(
            reverse(
                "v1:project-linkedin-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "member_urn": "urn:li:person:abc123",
                "expires_at": "2026-04-27T13:00:00Z",
                "is_active": True,
                "access_token": "access-token",
                "refresh_token": "refresh-token",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        credentials = LinkedInCredentials.objects.get(project=self.owner_project)
        self.assertEqual(credentials.member_urn, "urn:li:person:abc123")
        self.assertEqual(credentials.get_access_token(), "access-token")
        self.assertEqual(credentials.get_refresh_token(), "refresh-token")
        self.assertTrue(create_response.json()["has_stored_credential"])
        self.assertNotIn("access_token", create_response.json())
        self.assertNotIn("refresh_token", create_response.json())

        update_response = self.client.patch(
            reverse(
                "v1:project-linkedin-credentials-detail",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "pk": _require_pk(credentials),
                },
            ),
            {
                "member_urn": "urn:li:person:updated",
                "is_active": False,
            },
            format="json",
        )

        credentials.refresh_from_db()
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(credentials.member_urn, "urn:li:person:updated")
        self.assertFalse(credentials.is_active)
        self.assertEqual(credentials.get_access_token(), "access-token")
        self.assertEqual(credentials.get_refresh_token(), "refresh-token")

    def test_linkedin_credentials_create_requires_both_oauth_tokens(self):
        response = self.client.post(
            reverse(
                "v1:project-linkedin-credentials-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "member_urn": "urn:li:person:abc123",
                "expires_at": "2026-04-27T13:00:00Z",
                "is_active": True,
                "access_token": "",
                "refresh_token": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(response.json(), "access_token")

    def test_verify_linkedin_credentials_requires_configured_project_credentials(self):
        response = self.client.post(
            reverse(
                "v1:project-verify-linkedin-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "linkedin_credentials"
        )

    @patch("ingestion.plugins.linkedin.LinkedInSourcePlugin.verify_credentials")
    def test_verify_linkedin_credentials_verifies_project_account(self, verify_mock):
        credentials = LinkedInCredentials(
            project=self.owner_project,
            member_urn="urn:li:person:abc123",
        )
        credentials.set_access_token("access-token")
        credentials.set_refresh_token("refresh-token")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-linkedin-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        verify_mock.assert_called_once()
        verified_credentials = verify_mock.call_args.args[0]
        self.assertEqual(verified_credentials, credentials)
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["member_urn"], "urn:li:person:abc123")
        self.assertEqual(response.json()["last_error"], "")

    @patch("projects.api.build_linkedin_authorize_url")
    def test_start_linkedin_oauth_returns_authorize_url(self, build_authorize_url_mock):
        build_authorize_url_mock.return_value = (
            "https://www.linkedin.com/oauth/v2/authorization?state=signed-state"
        )

        response = self.client.post(
            reverse(
                "v1:project-start-linkedin-oauth",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            {"redirect_to": "/admin/sources?project=1"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        build_authorize_url_mock.assert_called_once_with(
            self.owner_project,
            "/admin/sources?project=1",
        )
        self.assertEqual(
            response.json(),
            {
                "authorize_url": (
                    "https://www.linkedin.com/oauth/v2/authorization?state=signed-state"
                )
            },
        )

    @override_settings(
        LINKEDIN_CLIENT_ID="linkedin-client-id",
        LINKEDIN_CLIENT_SECRET="linkedin-client-secret",
        LINKEDIN_OAUTH_SCOPES="openid email w_member_social",
    )
    def test_build_linkedin_authorize_url_uses_configured_scopes(self):
        authorize_url = build_linkedin_authorize_url(
            self.owner_project,
            "/admin/sources?project=1",
        )

        parsed_url = urlparse(authorize_url)
        query = parse_qs(parsed_url.query)

        self.assertEqual(parsed_url.netloc, "www.linkedin.com")
        self.assertEqual(
            query["scope"],
            ["openid email w_member_social"],
        )

    @patch("core.api.logger.exception")
    @patch(
        "ingestion.plugins.linkedin.LinkedInSourcePlugin.verify_credentials",
        side_effect=RuntimeError("bad token"),
    )
    def test_verify_linkedin_credentials_surfaces_verification_errors(
        self, _verify_mock, logger_exception_mock
    ):
        credentials = LinkedInCredentials(
            project=self.owner_project,
            member_urn="urn:li:person:abc123",
        )
        credentials.set_access_token("access-token")
        credentials.set_refresh_token("refresh-token")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-linkedin-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "linkedin_credentials"
        )
        self.assertNotIn("bad token", str(response.json()))
        logger_exception_mock.assert_called_once_with(
            "LinkedIn credential verification failed for project id=%s",
            _require_pk(self.owner_project),
        )

    @patch("projects.linkedin_oauth.LinkedInSourcePlugin.verify_credentials")
    @patch("projects.linkedin_oauth.requests.post")
    @override_settings(
        LINKEDIN_CLIENT_ID="linkedin-client-id",
        LINKEDIN_CLIENT_SECRET="linkedin-client-secret",
    )
    def test_linkedin_oauth_callback_persists_project_credentials(
        self,
        requests_post_mock,
        verify_credentials_mock,
    ):
        token_response = requests_post_mock.return_value
        token_response.raise_for_status.return_value = None
        token_response.json.return_value = {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
        }
        state = build_linkedin_oauth_state(
            self.owner_project,
            "/admin/sources?project=1",
        )

        response = self.client.get(
            reverse("v1:linkedin-oauth-callback"),
            {"state": state, "code": "oauth-code"},
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/admin/sources?project=1", response.headers["Location"])
        self.assertIn(
            "message=LinkedIn+credentials+authorized.",
            response.headers["Location"],
        )

        credentials = LinkedInCredentials.objects.get(project=self.owner_project)
        self.assertEqual(credentials.get_access_token(), "access-token")
        self.assertEqual(credentials.get_refresh_token(), "refresh-token")
        self.assertTrue(credentials.is_active)
        verify_credentials_mock.assert_called_once()

    def test_linkedin_oauth_callback_rejects_invalid_state(self):
        response = self.client.get(
            reverse("v1:linkedin-oauth-callback"),
            {"state": "bad-state", "code": "oauth-code"},
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/admin/sources", response.headers["Location"])
        self.assertIn("error=", response.headers["Location"])

    @patch("ingestion.plugins.mastodon.MastodonSourcePlugin.verify_credentials")
    def test_verify_mastodon_credentials_verifies_project_account(self, verify_mock):
        credentials = MastodonCredentials(
            project=self.owner_project,
            instance_url="https://hachyderm.io",
            account_acct="alice@hachyderm.io",
        )
        credentials.set_access_token("access-token")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-mastodon-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        verify_mock.assert_called_once()
        verified_credentials = verify_mock.call_args.args[0]
        self.assertEqual(verified_credentials, credentials)
        self.assertEqual(response.json()["status"], "verified")
        self.assertEqual(response.json()["account_acct"], "alice@hachyderm.io")
        self.assertEqual(response.json()["instance_url"], "https://hachyderm.io")
        self.assertEqual(response.json()["last_error"], "")

    @patch("core.api.logger.exception")
    @patch(
        "ingestion.plugins.mastodon.MastodonSourcePlugin.verify_credentials",
        side_effect=RuntimeError("bad token"),
    )
    def test_verify_mastodon_credentials_surfaces_verification_errors(
        self, _verify_mock, logger_exception_mock
    ):
        credentials = MastodonCredentials(
            project=self.owner_project,
            instance_url="https://hachyderm.io",
            account_acct="alice@hachyderm.io",
        )
        credentials.set_access_token("access-token")
        credentials.save()

        response = self.client.post(
            reverse(
                "v1:project-verify-mastodon-credentials",
                kwargs={"id": _require_pk(self.owner_project)},
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(
            response.json(), "mastodon_credentials"
        )
        self.assertNotIn("bad token", str(response.json()))
        logger_exception_mock.assert_called_once_with(
            "Mastodon credential verification failed for project id=%s",
            _require_pk(self.owner_project),
        )

    def test_source_config_create_validates_plugin_config(self):
        response = self.client.post(
            reverse(
                "v1:project-source-config-list",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"plugin_name": SourcePluginName.RSS, "config": {}},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_standardized_validation_error(response.json(), "config")
