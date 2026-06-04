from __future__ import annotations

from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from django.test import Client, override_settings
from django.urls import reverse

from projects.linkedin_oauth import (
    build_linkedin_authorize_url,
    build_linkedin_oauth_state,
)
from projects.models import LinkedInCredentials, Project

pytestmark = pytest.mark.django_db


@override_settings(
    LINKEDIN_CLIENT_ID="linkedin-client-id",
    LINKEDIN_CLIENT_SECRET="linkedin-client-secret",
    LINKEDIN_OAUTH_SCOPES="openid email w_member_social",
    NEWSLETTER_PUBLIC_URL="https://public.example.com",
)
def test_build_linkedin_authorize_url_uses_configured_scopes():
    project = Project.objects.create(
        name="Owner Project",
        topic_description="Platform engineering",
    )

    authorize_url = build_linkedin_authorize_url(
        project,
        "/admin/sources?project=1",
    )

    parsed_url = urlparse(authorize_url)
    query = parse_qs(parsed_url.query)

    assert parsed_url.netloc == "www.linkedin.com"
    assert query["redirect_uri"] == [
        "https://public.example.com/api/v1/linkedin/oauth/callback/"
    ]
    assert query["scope"] == ["openid email w_member_social"]


@patch("projects.linkedin_oauth.LinkedInSourcePlugin.verify_credentials")
@patch("projects.linkedin_oauth.requests.post")
@override_settings(
    LINKEDIN_CLIENT_ID="linkedin-client-id",
    LINKEDIN_CLIENT_SECRET="linkedin-client-secret",
)
def test_linkedin_oauth_callback_persists_project_credentials(
    requests_post_mock,
    verify_credentials_mock,
):
    project = Project.objects.create(
        name="Owner Project",
        topic_description="Platform engineering",
    )
    token_response = requests_post_mock.return_value
    token_response.raise_for_status.return_value = None
    token_response.json.return_value = {
        "access_token": "access-token",
        "refresh_token": "refresh-token",
        "expires_in": 3600,
    }
    state = build_linkedin_oauth_state(
        project,
        "/admin/sources?project=1",
    )

    response = Client().get(
        reverse("v1:linkedin-oauth-callback"),
        {"state": state, "code": "oauth-code"},
    )

    assert response.status_code == 302
    assert "/admin/sources?project=1" in response.headers["Location"]
    assert "message=LinkedIn+credentials+authorized." in response.headers["Location"]

    credentials = LinkedInCredentials.objects.get(project=project)
    assert credentials.get_access_token() == "access-token"
    assert credentials.get_refresh_token() == "refresh-token"
    assert credentials.is_active is True
    verify_credentials_mock.assert_called_once()


def test_linkedin_oauth_callback_rejects_invalid_state():
    response = Client().get(
        reverse("v1:linkedin-oauth-callback"),
        {"state": "bad-state", "code": "oauth-code"},
    )

    assert response.status_code == 302
    assert "/admin/sources" in response.headers["Location"]
    assert "error=" in response.headers["Location"]
