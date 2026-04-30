"""Cross-cutting helpers for project membership visibility and roles."""

from __future__ import annotations

from projects.models import Project, ProjectMembership


def get_visible_projects_queryset(user):
    """Return the projects visible to the given authenticated user."""

    if not getattr(user, "is_authenticated", False):
        return Project.objects.none()
    return Project.objects.filter(memberships__user=user).distinct()


def get_user_role(user, project: Project) -> str | None:
    """Return the user's membership role for the given project, if any."""

    if not getattr(user, "is_authenticated", False):
        return None
    return (
        ProjectMembership.objects.filter(user=user, project=project)
        .values_list("role", flat=True)
        .first()
    )