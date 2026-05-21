"""Tests for the initial Django Ninja users API surface."""

from __future__ import annotations

from io import BytesIO
from typing import Any, cast

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from projects.models import Project, ProjectMembership, ProjectRole
from users.models import AppUser, MembershipInvitation

pytestmark = pytest.mark.django_db


def _response(value: object) -> Any:
    """Return a typed response object for assertion helpers."""

    return cast(Any, value)


def make_avatar_file(
    *,
    filename: str = "avatar.png",
    image_format: str = "PNG",
    content_type: str = "image/png",
) -> SimpleUploadedFile:
    """Build a small in-memory image upload for avatar tests."""

    buffer = BytesIO()
    Image.new("RGB", (512, 512), color=(12, 34, 56)).save(buffer, format=image_format)
    return SimpleUploadedFile(filename, buffer.getvalue(), content_type=content_type)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, MEDIA_URL="/media/")
def test_ninja_profile_get_returns_the_authenticated_user(tmp_path):
    client = APIClient()
    user = AppUser.objects.create_user(
        username="ninja-profile-reader",
        email="reader@example.com",
        password="testpass123",
        display_name="Profile Reader",
        bio="Writes weekly edits.",
    )
    client.force_login(user)

    with override_settings(MEDIA_ROOT=tmp_path):
        response = _response(client.get("/api/ninja/v1/profile/"))

    assert response.status_code == 200
    assert response.json()["username"] == "ninja-profile-reader"
    assert response.json()["display_name"] == "Profile Reader"
    assert response.json()["avatar_url"] is None
    assert response.json()["avatar_thumbnail_url"] is None


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, MEDIA_URL="/media/")
def test_ninja_profile_patch_updates_profile_fields(tmp_path):
    client = APIClient()
    user = AppUser.objects.create_user(
        username="ninja-profile-editor", password="testpass123"
    )
    client.force_login(user)

    with override_settings(MEDIA_ROOT=tmp_path):
        response = _response(
            client.patch(
                "/api/ninja/v1/profile/",
                {
                    "display_name": "Profile Editor",
                    "bio": "Owns the editorial calendar.",
                    "timezone": "America/New_York",
                },
                format="json",
            )
        )

    user.refresh_from_db()
    assert response.status_code == 200
    assert user.display_name == "Profile Editor"
    assert user.bio == "Owns the editorial calendar."
    assert user.timezone == "America/New_York"


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, MEDIA_URL="/media/")
def test_ninja_profile_avatar_upload_returns_avatar_and_thumbnail_urls(tmp_path):
    client = APIClient()
    user = AppUser.objects.create_user(
        username="ninja-profile-avatar", password="testpass123"
    )
    client.force_login(user)

    with override_settings(MEDIA_ROOT=tmp_path):
        response = _response(
            client.post(
                "/api/ninja/v1/profile/avatar/",
                {"avatar": make_avatar_file()},
                format="multipart",
            )
        )

        user.refresh_from_db()
        thumbnail_path = tmp_path / f"avatars/{user.id}/thumb.webp"

    assert response.status_code == status.HTTP_200_OK
    assert user.avatar.name.endswith("avatar.png")
    assert response.json()["avatar_url"].endswith(f"/{user.avatar.name}")
    assert response.json()["avatar_thumbnail_url"].endswith(
        f"/avatars/{user.id}/thumb.webp"
    )
    assert thumbnail_path.exists()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, MEDIA_URL="/media/")
def test_ninja_profile_avatar_delete_clears_avatar_and_thumbnail(tmp_path):
    client = APIClient()
    user = AppUser.objects.create_user(
        username="ninja-profile-delete", password="testpass123"
    )
    client.force_login(user)

    with override_settings(MEDIA_ROOT=tmp_path):
        upload_response = _response(
            client.post(
                "/api/ninja/v1/profile/avatar/",
                {"avatar": make_avatar_file()},
                format="multipart",
            )
        )
        assert upload_response.status_code == 200

        response = _response(client.delete("/api/ninja/v1/profile/avatar/"))
        user.refresh_from_db()
        thumbnail_path = tmp_path / f"avatars/{user.id}/thumb.webp"

    assert response.status_code == 200
    assert user.avatar.name == ""
    assert response.json()["avatar_url"] is None
    assert response.json()["avatar_thumbnail_url"] is None
    assert thumbnail_path.exists() is False


def test_ninja_invitation_token_get_returns_public_payload():
    client = APIClient()
    inviter = AppUser.objects.create_user(
        username="ninja-inviter",
        email="inviter@example.com",
        password="testpass123",
    )
    project = Project.objects.create(
        name="Ninja Invitation Project",
        topic_description="Incremental API migration",
    )
    invitation = MembershipInvitation.objects.create(
        project=project,
        email="invitee@example.com",
        role=ProjectRole.READER,
        invited_by=inviter,
    )

    response = _response(client.get(f"/api/ninja/v1/invitations/{invitation.token}/"))

    assert response.status_code == 200
    assert response.json()["project_name"] == "Ninja Invitation Project"
    assert response.json()["status"] == "pending"


def test_ninja_invitation_token_post_accepts_matching_user():
    client = APIClient()
    inviter = AppUser.objects.create_user(
        username="ninja-inviter-accept",
        email="inviter@example.com",
        password="testpass123",
    )
    invitee = AppUser.objects.create_user(
        username="ninja-invitee",
        email="invitee@example.com",
        password="testpass123",
    )
    project = Project.objects.create(
        name="Ninja Accept Project",
        topic_description="Incremental API migration",
    )
    invitation = MembershipInvitation.objects.create(
        project=project,
        email=invitee.email,
        role=ProjectRole.MEMBER,
        invited_by=inviter,
    )
    client.force_login(invitee)

    response = _response(client.post(f"/api/ninja/v1/invitations/{invitation.token}/"))

    invitation.refresh_from_db()
    membership = ProjectMembership.objects.get(user=invitee, project=project)
    assert response.status_code == 200
    assert membership.role == ProjectRole.MEMBER
    assert invitation.accepted_at is not None
    assert response.json()["status"] == "accepted"
