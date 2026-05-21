"""Focused tests for the non-DRF auth views."""

from __future__ import annotations

import json

import pytest
from allauth.account.models import EmailAddress
from allauth.account.forms import default_token_generator
from allauth.account.utils import user_pk_to_url_str
from django.core import mail
from django.test import Client

from users.models import AppUser

pytestmark = pytest.mark.django_db


def test_login_view_accepts_username_and_returns_jwt_credentials():
    client = Client()
    user = AppUser.objects.create_user(
        username="credentials-user",
        email="credentials@example.com",
        password="testpass123",
    )

    response = client.post(
        "/api/auth/login/",
        data=json.dumps({"username": user.username, "password": "testpass123"}),
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access"]
    assert payload["refresh"]
    assert payload["user"]["username"] == user.username
    assert client.session.get("_auth_user_id") == str(user.id)


def test_login_view_accepts_email_and_issued_access_token_authenticates_ninja_api():
    client = Client()
    user = AppUser.objects.create_user(
        username="email-user",
        email="email-user@example.com",
        password="testpass123",
        display_name="Email Login",
    )

    login_response = client.post(
        "/api/auth/login/",
        data=json.dumps({"username": user.email, "password": "testpass123"}),
        content_type="application/json",
    )

    assert login_response.status_code == 200
    access_token = login_response.json()["access"]

    profile_response = client.get(
        "/api/v1/profile/",
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
    )

    assert profile_response.status_code == 200
    assert profile_response.json()["username"] == user.username


def test_login_view_rejects_bad_credentials():
    client = Client()
    AppUser.objects.create_user(
        username="bad-login-user",
        email="bad-login@example.com",
        password="testpass123",
    )

    response = client.post(
        "/api/auth/login/",
        data=json.dumps({"username": "bad-login@example.com", "password": "wrong"}),
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Bad credentials."


def test_register_view_creates_user_returns_jwt_credentials_and_logs_the_user_in():
    client = Client()

    response = client.post(
        "/api/auth/registration/",
        data=json.dumps(
            {
                "username": "registered-user",
                "email": "registered@example.com",
                "password1": "testpass123",
                "password2": "testpass123",
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["access"]
    assert payload["refresh"]
    assert payload["user"]["username"] == "registered-user"

    user = AppUser.objects.get(username="registered-user")
    assert client.session.get("_auth_user_id") == str(user.id)
    assert EmailAddress.objects.filter(
        user=user,
        email="registered@example.com",
    ).exists()


def test_register_view_issued_access_token_authenticates_ninja_api():
    client = Client()

    registration_response = client.post(
        "/api/auth/registration/",
        data=json.dumps(
            {
                "username": "registered-bearer-user",
                "email": "registered-bearer@example.com",
                "password1": "testpass123",
                "password2": "testpass123",
            }
        ),
        content_type="application/json",
    )

    assert registration_response.status_code == 201
    access_token = registration_response.json()["access"]

    profile_response = client.get(
        "/api/v1/profile/",
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
    )

    assert profile_response.status_code == 200
    assert profile_response.json()["username"] == "registered-bearer-user"


def test_register_view_rejects_password_mismatch():
    client = Client()

    response = client.post(
        "/api/auth/registration/",
        data=json.dumps(
            {
                "username": "mismatch-user",
                "email": "mismatch@example.com",
                "password1": "testpass123",
                "password2": "wrongpass456",
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "The two password fields didn't match."


def test_register_view_rejects_duplicate_email():
    client = Client()
    AppUser.objects.create_user(
        username="existing-user",
        email="duplicate@example.com",
        password="testpass123",
    )

    response = client.post(
        "/api/auth/registration/",
        data=json.dumps(
            {
                "username": "new-user",
                "email": "duplicate@example.com",
                "password1": "testpass123",
                "password2": "testpass123",
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "User is already registered with this e-mail address."
    )


def test_logout_view_clears_the_session_and_returns_success_detail():
    client = Client()
    user = AppUser.objects.create_user(
        username="logout-user",
        email="logout@example.com",
        password="testpass123",
    )
    client.force_login(user)

    response = client.post("/api/auth/logout/")

    assert response.status_code == 200
    assert response.json() == {"detail": "Successfully logged out."}
    assert client.session.get("_auth_user_id") is None


def test_user_view_returns_legacy_details_payload_for_bearer_auth():
    client = Client()
    user = AppUser.objects.create_user(
        username="details-user",
        email="details@example.com",
        password="testpass123",
        first_name="Detail",
        last_name="Reader",
    )

    login_response = client.post(
        "/api/auth/login/",
        data=json.dumps({"username": user.username, "password": "testpass123"}),
        content_type="application/json",
    )

    assert login_response.status_code == 200
    access_token = login_response.json()["access"]

    response = client.get(
        "/api/auth/user/",
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
    )

    assert response.status_code == 200
    assert response.json() == {
        "pk": user.pk,
        "username": "details-user",
        "email": "details@example.com",
        "first_name": "Detail",
        "last_name": "Reader",
    }


def test_user_view_updates_supported_fields_and_keeps_email_read_only():
    client = Client()
    user = AppUser.objects.create_user(
        username="editable-user",
        email="editable@example.com",
        password="testpass123",
        first_name="Old",
        last_name="Name",
    )
    client.force_login(user)

    response = client.patch(
        "/api/auth/user/",
        data=json.dumps(
            {
                "username": "edited-user",
                "first_name": "New",
                "last_name": "Person",
                "email": "ignored@example.com",
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.username == "edited-user"
    assert user.first_name == "New"
    assert user.last_name == "Person"
    assert user.email == "editable@example.com"
    assert response.json() == {
        "pk": user.pk,
        "username": "edited-user",
        "email": "editable@example.com",
        "first_name": "New",
        "last_name": "Person",
    }


def test_user_view_rejects_unauthenticated_requests():
    client = Client()

    response = client.get("/api/auth/user/")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication credentials were not provided."


def test_password_reset_view_sends_email_and_returns_success_detail():
    client = Client()
    AppUser.objects.create_user(
        username="reset-user",
        email="reset@example.com",
        password="testpass123",
    )

    response = client.post(
        "/api/auth/password/reset/",
        data=json.dumps({"email": "reset@example.com"}),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json() == {"detail": "Password reset e-mail has been sent."}
    assert len(mail.outbox) == 1
    assert "reset-password?" in mail.outbox[0].body
    assert "uid=" in mail.outbox[0].body
    assert "token=" in mail.outbox[0].body


def test_password_reset_view_does_not_leak_unknown_email_addresses():
    client = Client()

    response = client.post(
        "/api/auth/password/reset/",
        data=json.dumps({"email": "missing@example.com"}),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json() == {"detail": "Password reset e-mail has been sent."}
    assert len(mail.outbox) == 0


def test_password_reset_confirm_view_sets_the_new_password():
    client = Client()
    user = AppUser.objects.create_user(
        username="reset-confirm-user",
        email="reset-confirm@example.com",
        password="oldpass123",
    )
    uid = user_pk_to_url_str(user)
    token = default_token_generator.make_token(user)

    response = client.post(
        "/api/auth/password/reset/confirm/",
        data=json.dumps(
            {
                "uid": uid,
                "token": token,
                "new_password1": "newpass456",
                "new_password2": "newpass456",
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json() == {
        "detail": "Password has been reset with the new password."
    }

    login_response = client.post(
        "/api/auth/login/",
        data=json.dumps({"username": user.username, "password": "newpass456"}),
        content_type="application/json",
    )
    assert login_response.status_code == 200


def test_password_reset_confirm_view_rejects_invalid_token():
    client = Client()
    user = AppUser.objects.create_user(
        username="invalid-reset-user",
        email="invalid-reset@example.com",
        password="oldpass123",
    )

    response = client.post(
        "/api/auth/password/reset/confirm/",
        data=json.dumps(
            {
                "uid": user_pk_to_url_str(user),
                "token": "bad-token",
                "new_password1": "newpass456",
                "new_password2": "newpass456",
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json() == {"token": ["Invalid value"]}


def test_password_change_view_updates_password_and_keeps_session_valid():
    client = Client()
    user = AppUser.objects.create_user(
        username="password-change-user",
        email="password-change@example.com",
        password="oldpass123",
    )
    client.force_login(user)

    response = client.post(
        "/api/auth/password/change/",
        data=json.dumps(
            {
                "new_password1": "newpass456",
                "new_password2": "newpass456",
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json() == {"detail": "New password has been saved."}
    assert client.session.get("_auth_user_id") == str(user.id)

    client.logout()
    login_response = client.post(
        "/api/auth/login/",
        data=json.dumps({"username": user.username, "password": "newpass456"}),
        content_type="application/json",
    )
    assert login_response.status_code == 200


def test_password_change_view_rejects_unauthenticated_requests():
    client = Client()

    response = client.post(
        "/api/auth/password/change/",
        data=json.dumps(
            {
                "new_password1": "newpass456",
                "new_password2": "newpass456",
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication credentials were not provided."
