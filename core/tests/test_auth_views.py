"""Focused tests for the non-DRF social login views."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from django.test import Client

from users.models import AppUser

pytestmark = pytest.mark.django_db


def test_github_login_view_returns_jwt_credentials_and_logs_the_user_in():
    client = Client()
    user = AppUser.objects.create_user(
        username="github-social-user",
        email="github@example.com",
        password="testpass123",
    )

    with patch(
        "core.auth_views._authenticate_social_access_token", return_value=user
    ) as auth_mock:
        response = client.post(
            "/api/auth/github/",
            data=json.dumps({"access_token": "github-provider-token"}),
            content_type="application/json",
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access"]
    assert payload["refresh"]
    assert payload["user"]["username"] == user.username
    assert client.session.get("_auth_user_id") == str(user.id)
    auth_mock.assert_called_once()
    assert auth_mock.call_args.kwargs["access_token"] == "github-provider-token"


def test_google_login_view_forwards_id_token_and_returns_jwt_credentials():
    client = Client()
    user = AppUser.objects.create_user(
        username="google-social-user",
        email="google@example.com",
        password="testpass123",
    )

    with patch(
        "core.auth_views._authenticate_social_access_token", return_value=user
    ) as auth_mock:
        response = client.post(
            "/api/auth/google/",
            data=json.dumps(
                {"access_token": "google-provider-token", "id_token": "google-id-token"}
            ),
            content_type="application/json",
        )

    assert response.status_code == 200
    assert response.json()["user"]["email"] == user.email
    auth_mock.assert_called_once()
    assert auth_mock.call_args.kwargs["access_token"] == "google-provider-token"
    assert auth_mock.call_args.kwargs["id_token"] == "google-id-token"


def test_social_login_view_rejects_missing_access_token():
    client = Client()

    response = client.post(
        "/api/auth/github/",
        data=json.dumps({}),
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "access_token is required."
