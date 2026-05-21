from typing import Any, cast
from django.contrib.auth import get_user_model
from django.db.models import Model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from projects.models import (
    BlueskyCredentials,
    LinkedInCredentials,
    MastodonCredentials,
    Project,
    ProjectMembership,
    ProjectRole,
)


def _require_pk(instance: Model) -> int:
    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _typed_client(client: object) -> APIClient:
    return cast(APIClient, client)


def _create_user(user_model: type[Any], **kwargs: object):
    return cast(Any, user_model.objects).create_user(**kwargs)


class ProjectCredentialsNinjaApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpassword")
        self.other_user = _create_user(
            user_model, username="other", password="testpassword"
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

        self.member_project = Project.objects.create(
            name="Member Project",
            topic_description="Member",
        )
        ProjectMembership.objects.create(
            user=self.owner, project=self.member_project, role=ProjectRole.MEMBER
        )

        _typed_client(self.client).force_login(self.owner)

    def test_bluesky_credentials_list_create_and_update_hide_stored_password(self):
        url_list = reverse(
            "ninja-api:list_bluesky",
            kwargs={"project_id": _require_pk(self.owner_project)},
        )

        list_response = self.client.get(url_list)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.json(), [])

        create_response = self.client.post(
            url_list,
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
                "ninja-api:update_bluesky",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "cred_id": _require_pk(credentials),
                },
            ),
            {"handle": "@new.bsky.social"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        credentials.refresh_from_db()
        self.assertEqual(credentials.handle, "new.bsky.social")
        self.assertEqual(credentials.get_app_password(), "app-password")
        self.assertNotIn("app_password", update_response.json())

    def test_bluesky_credentials_permissions(self):
        url_list = reverse(
            "ninja-api:list_bluesky",
            kwargs={"project_id": _require_pk(self.member_project)},
        )
        create_response = self.client.post(
            url_list,
            {
                "handle": "@Owner.Project.BSKY.social",
                "pds_url": "https://pds.example.com/xrpc/",
                "is_active": True,
                "app_password": "app-password",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mastodon_credentials_list_create_and_update(self):
        url_list = reverse(
            "ninja-api:list_mastodon",
            kwargs={"project_id": _require_pk(self.owner_project)},
        )
        list_response = self.client.get(url_list)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)

        create_response = self.client.post(
            url_list,
            {
                "instance_url": "https://mastodon.social",
                "account_acct": "user@mastodon.social",
                "is_active": True,
                "access_token": "token123",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        credentials = MastodonCredentials.objects.get(project=self.owner_project)
        self.assertEqual(credentials.instance_url, "https://mastodon.social")
        self.assertEqual(credentials.get_access_token(), "token123")
        self.assertTrue(create_response.json()["has_stored_credential"])
        self.assertNotIn("access_token", create_response.json())

        url_detail = reverse(
            "ninja-api:update_mastodon",
            kwargs={
                "project_id": _require_pk(self.owner_project),
                "cred_id": _require_pk(credentials),
            },
        )
        update_response = self.client.patch(
            url_detail, {"account_acct": "newuser@mastodon.social"}, format="json"
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)

        delete_response = self.client.delete(
            reverse(
                "ninja-api:delete_mastodon",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "cred_id": _require_pk(credentials),
                },
            )
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_linkedin_credentials_list_create_and_update(self):
        url_list = reverse(
            "ninja-api:list_linkedin",
            kwargs={"project_id": _require_pk(self.owner_project)},
        )

        create_response = self.client.post(
            url_list,
            {
                "member_urn": "urn:li:person:12345",
                "is_active": True,
                "access_token": "access123",
                "refresh_token": "refresh123",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        credentials = LinkedInCredentials.objects.get(project=self.owner_project)
        self.assertEqual(credentials.member_urn, "urn:li:person:12345")
        self.assertEqual(credentials.get_access_token(), "access123")
        self.assertTrue(create_response.json()["has_stored_credential"])
        self.assertNotIn("access_token", create_response.json())
        self.assertNotIn("refresh_token", create_response.json())

        url_detail = reverse(
            "ninja-api:update_linkedin",
            kwargs={
                "project_id": _require_pk(self.owner_project),
                "cred_id": _require_pk(credentials),
            },
        )
        update_response = self.client.patch(
            url_detail, {"member_urn": "urn:li:person:67890"}, format="json"
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)

    def test_bluesky_credentials_create_requires_app_password(self):
        url_list = reverse(
            "ninja-api:list_bluesky",
            kwargs={"project_id": _require_pk(self.owner_project)},
        )
        response = self.client.post(
            url_list,
            {
                "handle": "owner.bsky.social",
                "pds_url": "",
                "is_active": True,
                "app_password": "",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_linkedin_credentials_create_requires_both_oauth_tokens(self):
        url_list = reverse(
            "ninja-api:list_linkedin",
            kwargs={"project_id": _require_pk(self.owner_project)},
        )
        response = self.client.post(
            url_list,
            {
                "member_urn": "urn:li:person:12345",
                "is_active": True,
                "access_token": "",
                "refresh_token": "refresh-token",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
