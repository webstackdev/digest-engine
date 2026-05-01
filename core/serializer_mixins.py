"""Shared DRF serializer mixins used across app-owned serializer modules."""

from typing import Any, cast

from rest_framework import serializers

from core.models import Content, SkillResult
from core.permissions import get_visible_projects_queryset
from entities.models import Entity


class ProjectScopedSerializerMixin:
    """Limit serializer relationship fields to objects the current user can access."""

    def _serializer(self) -> serializers.Serializer:
        """Return ``self`` as a DRF serializer for typed mixin access."""

        return cast(serializers.Serializer, self)

    def _filter_related_queryset(self, request):
        """Constrain related-field querysets using the request user and project context."""

        serializer = self._serializer()
        fields = cast(dict[str, Any], serializer.fields)
        user = request.user
        project = serializer.context.get("project")
        if "project" in fields:
            fields["project"].queryset = get_visible_projects_queryset(user)
        if "entity" in fields:
            entity_queryset = (
                Entity.objects.filter(project=project)
                if project
                else Entity.objects.filter(project__memberships__user=user).distinct()
            )
            fields["entity"].queryset = entity_queryset
        if "merged_into" in fields:
            merged_into_queryset = (
                Entity.objects.filter(project=project)
                if project
                else Entity.objects.filter(project__memberships__user=user).distinct()
            )
            fields["merged_into"].queryset = merged_into_queryset
        if "content" in fields:
            content_queryset = (
                Content.objects.filter(project=project)
                if project
                else Content.objects.filter(project__memberships__user=user).distinct()
            )
            fields["content"].queryset = content_queryset
        if "superseded_by" in fields:
            skill_result_queryset = (
                SkillResult.objects.filter(project=project)
                if project
                else SkillResult.objects.filter(
                    project__memberships__user=user
                ).distinct()
            )
            fields["superseded_by"].queryset = skill_result_queryset

    def __init__(self, *args, **kwargs):
        """Initialize the serializer and scope relation fields when authenticated."""

        super().__init__(*args, **kwargs)
        request = self._serializer().context.get("request")
        if request and request.user.is_authenticated:
            self._filter_related_queryset(request)
