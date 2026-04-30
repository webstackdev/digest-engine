"""Tests for the custom AppUser foundation."""

import pytest
from django.contrib.auth.models import Group

from projects.models import Project, ProjectMembership, ProjectRole
from users.models import AppUser, avatar_upload_path

pytestmark = pytest.mark.django_db


def test_app_user_uses_display_name_in_string_representation():
    user = AppUser(username="reader", display_name="Platform Reader")

    assert str(user) == "Platform Reader"


def test_avatar_upload_path_uses_user_prefix():
    user = AppUser(pk=42, username="reader")

    assert avatar_upload_path(user, "avatar.png") == "avatars/42/avatar.png"


def test_app_user_project_membership_drives_project_visibility():
    group = Group.objects.create(name="platform-team")
    user = AppUser.objects.create_user(username="reader", password="testpass123")
    user.groups.add(group)
    project = Project.objects.create(
        name="Platform Weekly",
        group=group,
        topic_description="Platform engineering",
    )
    ProjectMembership.objects.create(
        user=user,
        project=project,
        role=ProjectRole.ADMIN,
    )

    visible_projects = Project.objects.filter(memberships__user=user).distinct()

    assert list(visible_projects) == [project]
