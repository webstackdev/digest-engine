import pytest

from core.permissions import get_user_role, get_visible_projects_queryset
from projects.models import Project, ProjectMembership, ProjectRole

pytestmark = pytest.mark.django_db


def test_visible_projects_queryset_uses_memberships(django_user_model):
    user = django_user_model.objects.create_user(
        username="member-user",
        password="testpass123",
    )
    outsider = django_user_model.objects.create_user(
        username="outsider-user",
        password="testpass123",
    )
    project = Project.objects.create(
        name="Membership Project",
        topic_description="Platform engineering",
    )
    other_project = Project.objects.create(
        name="Outsider Project",
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
    project = Project.objects.create(
        name="Role Project",
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
    project = Project.objects.create(
        name="Removal Project",
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
