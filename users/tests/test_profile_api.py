"""Tests for the current-user profile API."""

from __future__ import annotations

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APIClient

from users.models import AppUser

pytestmark = pytest.mark.django_db


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
def test_profile_get_returns_the_authenticated_user(tmp_path):
    client = APIClient()
    user = AppUser.objects.create_user(
        username="profile-reader",
        email="reader@example.com",
        password="testpass123",
        display_name="Profile Reader",
        bio="Writes weekly edits.",
    )
    client.force_authenticate(user)

    with override_settings(MEDIA_ROOT=tmp_path):
        response = client.get("/api/v1/profile/")

    assert response.status_code == 200
    assert response.json()["username"] == "profile-reader"
    assert response.json()["display_name"] == "Profile Reader"
    assert response.json()["avatar_url"] is None
    assert response.json()["avatar_thumbnail_url"] is None


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, MEDIA_URL="/media/")
def test_profile_patch_updates_profile_fields(tmp_path):
    client = APIClient()
    user = AppUser.objects.create_user(
        username="profile-editor", password="testpass123"
    )
    client.force_authenticate(user)

    with override_settings(MEDIA_ROOT=tmp_path):
        response = client.patch(
            "/api/v1/profile/",
            {
                "display_name": "Profile Editor",
                "bio": "Owns the editorial calendar.",
                "timezone": "America/New_York",
            },
            format="json",
        )

    user.refresh_from_db()
    assert response.status_code == 200
    assert user.display_name == "Profile Editor"
    assert user.bio == "Owns the editorial calendar."
    assert user.timezone == "America/New_York"


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, MEDIA_URL="/media/")
def test_profile_avatar_upload_returns_avatar_and_thumbnail_urls(tmp_path):
    client = APIClient()
    user = AppUser.objects.create_user(
        username="profile-avatar", password="testpass123"
    )
    client.force_authenticate(user)

    with override_settings(MEDIA_ROOT=tmp_path):
        response = client.post(
            "/api/v1/profile/avatar/",
            {"avatar": make_avatar_file()},
            format="multipart",
        )

        user.refresh_from_db()
        thumbnail_path = tmp_path / f"avatars/{user.id}/thumb.webp"

    assert response.status_code == 200
    assert user.avatar.name.endswith("avatar.png")
    assert response.json()["avatar_url"].endswith(f"/{user.avatar.name}")
    assert response.json()["avatar_thumbnail_url"].endswith(
        f"/avatars/{user.id}/thumb.webp"
    )
    assert thumbnail_path.exists()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, MEDIA_URL="/media/")
def test_profile_avatar_delete_clears_avatar_and_thumbnail(tmp_path):
    client = APIClient()
    user = AppUser.objects.create_user(
        username="profile-delete", password="testpass123"
    )
    client.force_authenticate(user)

    with override_settings(MEDIA_ROOT=tmp_path):
        upload_response = client.post(
            "/api/v1/profile/avatar/",
            {"avatar": make_avatar_file()},
            format="multipart",
        )
        assert upload_response.status_code == 200

        response = client.delete("/api/v1/profile/avatar/")
        user.refresh_from_db()
        thumbnail_path = tmp_path / f"avatars/{user.id}/thumb.webp"

    assert response.status_code == 200
    assert user.avatar.name == ""
    assert response.json()["avatar_url"] is None
    assert response.json()["avatar_thumbnail_url"] is None
    assert thumbnail_path.exists() is False
