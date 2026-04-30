"""Cross-cutting helpers and DRF permission classes for project roles."""

from __future__ import annotations

from rest_framework import permissions

from projects.models import Project, ProjectMembership, ProjectRole


def get_visible_projects_queryset(user):
    """Return the projects visible to the given authenticated user."""

    if not getattr(user, "is_authenticated", False):
        return Project.objects.none()
    return Project.objects.filter(memberships__user=user).distinct()


def get_user_role(user, project: Project) -> str | None:
    """Return the user's membership role for the given project, if any."""

    if not getattr(user, "is_authenticated", False):
        return None
    if getattr(user, "is_superuser", False):
        return ProjectRole.ADMIN
    return (
        ProjectMembership.objects.filter(user=user, project=project)
        .values_list("role", flat=True)
        .first()
    )


def _get_project_from_view(view) -> Project | None:
    """Resolve the current nested project from a project-scoped view when present."""

    get_project = getattr(view, "get_project", None)
    if callable(get_project):
        return get_project()
    return None


def _resolve_project(obj) -> Project:
    """Resolve the owning project for a project-scoped model instance."""

    if isinstance(obj, Project):
        return obj
    return obj.project


class IsProjectMember(permissions.BasePermission):
    """Allow authenticated project members to read project-scoped resources."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False

        project = _get_project_from_view(view)
        if project is None:
            return True

        return get_user_role(user, project) is not None

    def has_object_permission(self, request, view, obj) -> bool:
        return get_user_role(request.user, _resolve_project(obj)) is not None


class IsProjectContributor(permissions.BasePermission):
    """Allow only admins and members to access contributor-only resources."""

    allowed_roles = {ProjectRole.ADMIN, ProjectRole.MEMBER}

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False

        project = _get_project_from_view(view)
        if project is None:
            return True

        return get_user_role(user, project) in self.allowed_roles

    def has_object_permission(self, request, view, obj) -> bool:
        return get_user_role(request.user, _resolve_project(obj)) in self.allowed_roles


class IsProjectMemberWritable(permissions.BasePermission):
    """Allow all members to read, but reserve writes for admins and members."""

    writable_roles = {ProjectRole.ADMIN, ProjectRole.MEMBER}

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False

        project = _get_project_from_view(view)
        if project is None:
            return True

        role = get_user_role(user, project)
        if request.method in permissions.SAFE_METHODS:
            return role is not None
        return role in self.writable_roles

    def has_object_permission(self, request, view, obj) -> bool:
        role = get_user_role(request.user, _resolve_project(obj))
        if request.method in permissions.SAFE_METHODS:
            return role is not None
        return role in self.writable_roles


class IsProjectAdmin(permissions.BasePermission):
    """Restrict access to project admins."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False

        project = _get_project_from_view(view)
        if project is None:
            return True

        return get_user_role(user, project) == ProjectRole.ADMIN

    def has_object_permission(self, request, view, obj) -> bool:
        return get_user_role(request.user, _resolve_project(obj)) == ProjectRole.ADMIN


class IsProjectFeedbackEditor(permissions.BasePermission):
    """Allow feedback reads to any member and writes by owners or project admins."""

    contributor_roles = {ProjectRole.ADMIN, ProjectRole.MEMBER}

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False

        project = _get_project_from_view(view)
        if project is None:
            return True

        role = get_user_role(user, project)
        if request.method in permissions.SAFE_METHODS:
            return role is not None
        return role in self.contributor_roles

    def has_object_permission(self, request, view, obj) -> bool:
        role = get_user_role(request.user, _resolve_project(obj))
        if request.method in permissions.SAFE_METHODS:
            return role is not None
        if role == ProjectRole.ADMIN:
            return True
        if role != ProjectRole.MEMBER:
            return False
        return obj.user_id == request.user.id
