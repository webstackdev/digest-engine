from importlib import import_module

import pytest
from django.apps import apps as django_apps
from django.contrib.auth.models import Group

from core.permissions import get_user_role, get_visible_projects_queryset
from projects.models import Project, ProjectMembership, ProjectRole

pytestmark = pytest.mark.django_db


backfill_project_memberships = import_module(
    "projects.migrations.0002_alter_project_group_projectmembership_and_more"
).backfill_project_memberships


def test_backfill_project_memberships_creates_admin_and_member_roles(
    django_user_model,
):
    first_user = django_user_model.objects.create_user(
        username="first-user",
        password="testpass123",
    )
    second_user = django_user_model.objects.create_user(
        username="second-user",
        password="testpass123",
    )
    group = Group.objects.create(name="backfill-team")
    first_user.groups.add(group)
    second_user.groups.add(group)
    project = Project.objects.create(
        name="Backfill Project",
        group=group,
        topic_description="Platform engineering",
    )

    backfill_project_memberships(django_apps, None)

    memberships = list(project.memberships.order_by("user_id"))
    assert [membership.user_id for membership in memberships] == [
        first_user.id,
        second_user.id,
    ]
    assert [membership.role for membership in memberships] == [
        ProjectRole.ADMIN,
        ProjectRole.MEMBER,
    ]


def test_visible_projects_queryset_uses_memberships(django_user_model):
    user = django_user_model.objects.create_user(
        username="member-user",
        password="testpass123",
    )
    outsider = django_user_model.objects.create_user(
        username="outsider-user",
        password="testpass123",
    )
    group = Group.objects.create(name="membership-team")
    project = Project.objects.create(
        name="Membership Project",
        group=group,
        topic_description="Platform engineering",
    )
    other_project = Project.objects.create(
        name="Outsider Project",
        group=group,
        topic_description="Frontend",
    )
    ProjectMembership.objects.create(
        user=user,
        project=project,
        role=ProjectRole.ADMIN,
    )
    ProjectMembership.objects.create(
        user=outsider,
        project=other_project,
        role=ProjectRole.ADMIN,
    )

    assert list(get_visible_projects_queryset(user)) == [project]


def test_get_user_role_returns_membership_role(django_user_model):
    user = django_user_model.objects.create_user(
        username="role-user",
        password="testpass123",
    )
    group = Group.objects.create(name="role-team")
    project = Project.objects.create(
        name="Role Project",
        group=group,
        topic_description="Platform engineering",
    )
    ProjectMembership.objects.create(
        user=user,
        project=project,
        role=ProjectRole.READER,
    )

    assert get_user_role(user, project) == ProjectRole.READER


def test_removing_membership_removes_project_visibility(django_user_model):
    user = django_user_model.objects.create_user(
        username="remove-user",
        password="testpass123",
    )
    group = Group.objects.create(name="remove-team")
    project = Project.objects.create(
        name="Removal Project",
        group=group,
        topic_description="Platform engineering",
    )
    membership = ProjectMembership.objects.create(
        user=user,
        project=project,
        role=ProjectRole.MEMBER,
    )

    assert list(get_visible_projects_queryset(user)) == [project]

    membership.delete()

    assert list(get_visible_projects_queryset(user)) == []
