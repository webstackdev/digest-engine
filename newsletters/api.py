"""Newsletter-domain API viewsets kept under the existing nested project routes."""

from typing import Any, cast

from django.conf import settings
from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response

from core.api import (
    AUTHENTICATION_REQUIRED_RESPONSE,
    ProjectOwnedQuerysetMixin,
    build_crud_action_overrides,
    document_project_owned_viewset,
)
from core.permissions import IsProjectContributor, IsProjectMember
from newsletters.models import (
    IntakeAllowlist,
    NewsletterDraft,
    NewsletterDraftItem,
    NewsletterDraftOriginalPiece,
    NewsletterDraftSection,
    NewsletterDraftStatus,
    NewsletterIntake,
)
from newsletters.serializers import (
    IntakeAllowlistSerializer,
    NewsletterDraftItemSerializer,
    NewsletterDraftOriginalPieceSerializer,
    NewsletterDraftRegenerateSectionSerializer,
    NewsletterDraftSectionSerializer,
    NewsletterDraftSerializer,
    NewsletterIntakeSerializer,
)
from newsletters.tasks import (
    generate_newsletter_draft,
    regenerate_newsletter_draft_section,
)


@document_project_owned_viewset(
    resource_plural="intake allowlist entries",
    resource_singular="intake allowlist entry",
    create_description=(
        "Create a new confirmed or pending sender allowlist entry for the selected "
        "project's newsletter intake workflow."
    ),
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        IntakeAllowlistSerializer,
        resource_plural="intake allowlist entries for the selected project",
        resource_singular="intake allowlist entry",
    ),
)
class IntakeAllowlistViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Manage newsletter sender allowlist entries for a project."""

    serializer_class = IntakeAllowlistSerializer
    queryset = IntakeAllowlist.objects.select_related("project")

    def get_permissions(self):
        """Restrict intake allowlist access to project contributors."""

        return [IsProjectContributor()]


@document_project_owned_viewset(
    resource_plural="newsletter intake entries",
    resource_singular="newsletter intake entry",
    create_description=(
        "Newsletter intake entries are created by inbound email processing and are "
        "exposed read-only for audit and troubleshooting."
    ),
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        NewsletterIntakeSerializer,
        resource_plural="newsletter intake entries for the selected project",
        resource_singular="newsletter intake entry",
    ),
)
class NewsletterIntakeViewSet(ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Inspect inbound newsletter history for a project."""

    serializer_class = NewsletterIntakeSerializer
    queryset = NewsletterIntake.objects.select_related("project")

    def get_permissions(self):
        """Allow any project member to inspect newsletter intake history."""

        return [IsProjectMember()]


class ProjectRelatedQuerysetMixin(ProjectOwnedQuerysetMixin):
    """Scope nested resources to a project through an indirect relationship path."""

    project_filter: str = "project"

    def get_queryset(self):
        """Filter the configured queryset down to the current project path."""

        queryset = self.queryset
        if queryset is None:
            raise AssertionError("queryset must be set on project-scoped viewsets")
        return queryset.filter(**{self.project_filter: self.get_project()})


class DraftEditedTimestampMixin:
    """Touch the owning draft whenever an editor mutates a draft subtree."""

    draft_lookup: str = "draft"

    def perform_update(self, serializer):
        """Persist the mutation and mark the owning draft as editor-modified."""

        instance = serializer.save()
        draft = cast(NewsletterDraft, _resolve_nested_attr(instance, self.draft_lookup))
        draft.status = NewsletterDraftStatus.EDITED
        draft.last_edited_at = timezone.now()
        draft.save(update_fields=["status", "last_edited_at"])

    def perform_destroy(self, instance):
        """Delete the subtree node and mark the owning draft as editor-modified."""

        draft = cast(NewsletterDraft, _resolve_nested_attr(instance, self.draft_lookup))
        instance.delete()
        draft.status = NewsletterDraftStatus.EDITED
        draft.last_edited_at = timezone.now()
        draft.save(update_fields=["status", "last_edited_at"])


class NewsletterDraftViewSet(
    ProjectOwnedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Inspect, edit, and generate project-scoped newsletter drafts."""

    serializer_class = NewsletterDraftSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ["generated_at", "target_publish_date", "status"]
    ordering = ["-generated_at", "-id"]
    http_method_names = ["get", "patch", "post", "head", "options"]
    queryset = NewsletterDraft.objects.select_related("project").prefetch_related(
        Prefetch(
            "sections",
            queryset=NewsletterDraftSection.objects.select_related(
                "theme_suggestion"
            ).prefetch_related(
                Prefetch(
                    "items",
                    queryset=NewsletterDraftItem.objects.select_related("content"),
                )
            ),
        ),
        Prefetch(
            "original_pieces",
            queryset=NewsletterDraftOriginalPiece.objects.select_related("idea"),
        ),
    )

    def get_permissions(self):
        """Allow members to read drafts and contributors to mutate or generate."""

        if self.action in {"generate", "partial_update", "regenerate_section"}:
            return [IsProjectContributor()]
        return [IsProjectMember()]

    def perform_update(self, serializer):
        """Persist top-level draft edits and mark the draft as editor-modified."""

        serializer.save(
            status=NewsletterDraftStatus.EDITED,
            last_edited_at=timezone.now(),
        )

    @extend_schema(
        summary="Generate newsletter draft",
        description=(
            "Trigger newsletter draft generation for the selected project. When Celery "
            "runs eagerly, the draft is composed before the response is returned. "
            "Otherwise, the generation task is queued for background execution."
        ),
        request=None,
        responses={
            200: inline_serializer(
                name="NewsletterDraftGenerateCompletedResponse",
                fields={
                    "status": serializers.CharField(),
                    "project_id": serializers.IntegerField(),
                    "result": inline_serializer(
                        name="NewsletterDraftGenerateResult",
                        fields={
                            "project_id": serializers.IntegerField(),
                            "draft_id": serializers.IntegerField(allow_null=True),
                            "status": serializers.CharField(),
                            "reason": serializers.CharField(required=False),
                            "sections_created": serializers.IntegerField(),
                            "original_pieces_created": serializers.IntegerField(),
                        },
                    ),
                },
            ),
            202: inline_serializer(
                name="NewsletterDraftGenerateQueuedResponse",
                fields={
                    "status": serializers.CharField(),
                    "project_id": serializers.IntegerField(),
                },
            ),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Newsletter Composition"],
    )
    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request, *args, **kwargs):
        """Trigger draft composition for the current project."""

        project = self.get_project()
        project_id = int(project.pk)
        if settings.CELERY_TASK_ALWAYS_EAGER:
            result = generate_newsletter_draft(project_id)
            return Response(
                {
                    "status": "completed",
                    "project_id": project_id,
                    "result": result,
                }
            )
        generate_newsletter_draft.delay(project_id)
        return Response(
            {"status": "queued", "project_id": project_id},
            status=status.HTTP_202_ACCEPTED,
        )

    @extend_schema(
        summary="Regenerate newsletter draft section",
        description=(
            "Recompose one section inside an existing draft without rebuilding the rest "
            "of the draft tree."
        ),
        request=NewsletterDraftRegenerateSectionSerializer,
        responses={
            200: NewsletterDraftSerializer,
            202: inline_serializer(
                name="NewsletterDraftRegenerateQueuedResponse",
                fields={
                    "status": serializers.CharField(),
                    "draft_id": serializers.IntegerField(),
                    "section_id": serializers.IntegerField(),
                },
            ),
            400: NewsletterDraftRegenerateSectionSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Newsletter Composition"],
    )
    @action(detail=True, methods=["post"], url_path="regenerate_section")
    def regenerate_section(self, request, *args, **kwargs):
        """Recompose one draft section for the selected draft."""

        draft = self.get_object()
        serializer = NewsletterDraftRegenerateSectionSerializer(
            data=request.data,
            context={**self.get_serializer_context(), "draft": draft},
        )
        serializer.is_valid(raise_exception=True)
        section_id = serializer.validated_data["section_id"]
        if settings.CELERY_TASK_ALWAYS_EAGER:
            regenerate_newsletter_draft_section(section_id)
            draft.refresh_from_db()
            response_serializer = self.get_serializer(draft)
            return Response(response_serializer.data)
        regenerate_newsletter_draft_section.delay(section_id)
        return Response(
            {
                "status": "queued",
                "draft_id": int(draft.pk),
                "section_id": section_id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class NewsletterDraftSectionViewSet(
    ProjectRelatedQuerysetMixin,
    DraftEditedTimestampMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Edit or remove draft sections under one project."""

    serializer_class = NewsletterDraftSectionSerializer
    project_filter = "draft__project"
    draft_lookup = "draft"
    http_method_names = ["get", "patch", "delete", "head", "options"]
    queryset = NewsletterDraftSection.objects.select_related(
        "draft",
        "theme_suggestion",
    ).prefetch_related(
        Prefetch(
            "items",
            queryset=NewsletterDraftItem.objects.select_related("content"),
        )
    )

    def get_permissions(self):
        """Allow members to read sections and contributors to edit them."""

        if self.action in {"partial_update", "destroy"}:
            return [IsProjectContributor()]
        return [IsProjectMember()]


class NewsletterDraftItemViewSet(
    ProjectRelatedQuerysetMixin,
    DraftEditedTimestampMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Edit or remove draft items under one project."""

    serializer_class = NewsletterDraftItemSerializer
    project_filter = "section__draft__project"
    draft_lookup = "section.draft"
    http_method_names = ["get", "patch", "delete", "head", "options"]
    queryset = NewsletterDraftItem.objects.select_related(
        "section",
        "section__draft",
        "content",
    )

    def get_permissions(self):
        """Allow members to read items and contributors to edit them."""

        if self.action in {"partial_update", "destroy"}:
            return [IsProjectContributor()]
        return [IsProjectMember()]


class NewsletterDraftOriginalPieceViewSet(
    ProjectRelatedQuerysetMixin,
    DraftEditedTimestampMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Edit or remove draft original-content blocks under one project."""

    serializer_class = NewsletterDraftOriginalPieceSerializer
    project_filter = "draft__project"
    draft_lookup = "draft"
    http_method_names = ["get", "patch", "delete", "head", "options"]
    queryset = NewsletterDraftOriginalPiece.objects.select_related("draft", "idea")

    def get_permissions(self):
        """Allow members to read original pieces and contributors to edit them."""

        if self.action in {"partial_update", "destroy"}:
            return [IsProjectContributor()]
        return [IsProjectMember()]


def _resolve_nested_attr(instance: object, dotted_path: str) -> object:
    """Resolve a dotted attribute path on a loaded model instance."""

    current: Any = instance
    for attribute in dotted_path.split("."):
        current = getattr(current, attribute)
    return current
