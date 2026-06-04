"""Shared helpers for project-scoped Django Ninja routes."""

from __future__ import annotations

from typing import Any

from ninja.errors import HttpError

from core.permissions import get_visible_projects_queryset
from projects.models import Project, ProjectMembership, ProjectRole


def _get_project_or_404(request: Any, project_id: int) -> Project:
    """Load one project if the authenticated user has access."""

    project = (
        get_visible_projects_queryset(request.user)
        .filter(id=project_id)
        .select_related("bluesky_credentials")
        .first()
    )
    if not project:
        raise HttpError(404, "Not found.")
    return project


def _require_project_writable(request: Any, project_id: int) -> Project:
    """Load one project, requiring admin or member write access."""

    project = _get_project_or_404(request, project_id)
    membership = ProjectMembership.objects.filter(
        project=project, user=request.user
    ).first()
    if not membership or membership.role not in {ProjectRole.ADMIN, ProjectRole.MEMBER}:
        raise HttpError(403, "You do not have permission to perform this action.")
    return project


def _require_project_admin(request: Any, project_id: int) -> Project:
    """Load one project, requiring admin access."""

    project = _get_project_or_404(request, project_id)
    membership = ProjectMembership.objects.filter(
        project=project, user=request.user
    ).first()
    if not membership or membership.role != ProjectRole.ADMIN:
        raise HttpError(403, "You do not have permission to perform this action.")
    return project


__all__ = [
    "_get_project_or_404",
    "_require_project_admin",
    "_require_project_writable",
]
