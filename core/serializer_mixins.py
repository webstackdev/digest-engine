"""Shared DRF serializer mixins used across app-owned serializer modules."""

from core.models import Content, SkillResult
from core.permissions import get_visible_projects_queryset
from entities.models import Entity


class ProjectScopedSerializerMixin:
    """Limit serializer relationship fields to objects the current user can access."""

    def _filter_related_queryset(self, request):
        """Constrain related-field querysets using the request user and project context."""

        user = request.user
        project = self.context.get("project")
        if "project" in self.fields:
            self.fields["project"].queryset = get_visible_projects_queryset(user)
        if "entity" in self.fields:
            entity_queryset = (
                Entity.objects.filter(project=project)
                if project
                else Entity.objects.filter(project__memberships__user=user).distinct()
            )
            self.fields["entity"].queryset = entity_queryset
        if "merged_into" in self.fields:
            merged_into_queryset = (
                Entity.objects.filter(project=project)
                if project
                else Entity.objects.filter(project__memberships__user=user).distinct()
            )
            self.fields["merged_into"].queryset = merged_into_queryset
        if "content" in self.fields:
            content_queryset = (
                Content.objects.filter(project=project)
                if project
                else Content.objects.filter(project__memberships__user=user).distinct()
            )
            self.fields["content"].queryset = content_queryset
        if "superseded_by" in self.fields:
            skill_result_queryset = (
                SkillResult.objects.filter(project=project)
                if project
                else SkillResult.objects.filter(
                    project__memberships__user=user
                ).distinct()
            )
            self.fields["superseded_by"].queryset = skill_result_queryset

    def __init__(self, *args, **kwargs):
        """Initialize the serializer and scope relation fields when authenticated."""

        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self._filter_related_queryset(request)
