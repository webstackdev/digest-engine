"""Entity-domain API viewsets kept under the existing nested project routes."""

from django.db.models import Count, Prefetch
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response

from core.api import (
    AUTHENTICATION_REQUIRED_RESPONSE,
    ProjectOwnedQuerysetMixin,
    build_crud_action_overrides,
    document_project_owned_viewset,
)
from entities.extraction import (
    accept_entity_candidate,
    merge_entity_candidate,
    reject_entity_candidate,
)
from core.permissions import (
    IsProjectAdmin,
    IsProjectContributor,
    IsProjectMember,
    IsProjectMemberWritable,
)
from entities.models import Entity, EntityCandidate, EntityMention
from entities.serializers import (
    EntityAuthoritySnapshotSerializer,
    EntityCandidateMergeSerializer,
    EntityCandidateSerializer,
    EntityMentionSummarySerializer,
    EntitySerializer,
)


@document_project_owned_viewset(
    resource_plural="entities",
    resource_singular="entity",
    create_description="Create a new tracked entity for the selected project, such as a company, person, or organization.",
    tag="Entity Catalog",
    action_overrides=build_crud_action_overrides(
        EntitySerializer,
        resource_plural="entities for the selected project",
        resource_singular="entity",
    ),
)
class EntityViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Manage tracked entities associated with a project."""

    serializer_class = EntitySerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ["authority_score", "created_at", "name"]
    ordering = ["name"]
    queryset = (
        Entity.objects.select_related("project")
        .annotate(mention_count=Count("mentions", distinct=True))
        .prefetch_related(
            Prefetch(
                "mentions",
                queryset=EntityMention.objects.select_related("content").order_by(
                    "-created_at"
                ),
                to_attr="prefetched_mentions",
            )
        )
    )

    def get_permissions(self):
        """Apply read, contributor-write, and admin-delete permissions for entities."""

        if self.action == "destroy":
            permission_classes = [IsProjectAdmin]
        elif self.action in {"create", "update", "partial_update"}:
            permission_classes = [IsProjectMemberWritable]
        else:
            permission_classes = [IsProjectMember]
        return [permission() for permission in permission_classes]

    @extend_schema(
        summary="List entity mentions",
        description="Return the extracted mention history for one tracked entity inside the selected project.",
        request=None,
        responses={
            200: EntityMentionSummarySerializer(many=True),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Entity Catalog"],
    )
    @action(detail=True, methods=["get"], url_path="mentions")
    def mentions(self, request, *args, **kwargs):
        """Return the extracted mentions for the selected entity."""

        entity = self.get_object()
        mentions = entity.mentions.select_related("content").order_by("-created_at")
        serializer = EntityMentionSummarySerializer(mentions, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="List authority history",
        description=(
            "Return persisted authority-score snapshots for one tracked entity. "
            "Use the optional limit query parameter to cap the number of snapshots returned."
        ),
        parameters=[
            OpenApiParameter(
                name="limit",
                type=int,
                location=OpenApiParameter.QUERY,
                description="Maximum number of authority snapshots to return.",
                required=False,
            )
        ],
        request=None,
        responses={
            200: EntityAuthoritySnapshotSerializer(many=True),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Entity Catalog"],
    )
    @action(detail=True, methods=["get"], url_path="authority_history")
    def authority_history(self, request, *args, **kwargs):
        """Return recent authority snapshots for the selected entity."""

        entity = self.get_object()
        snapshots = entity.authority_snapshots.order_by("-computed_at")
        limit_param = request.query_params.get("limit")
        if limit_param:
            try:
                limit = max(1, min(int(limit_param), 100))
            except ValueError as exc:
                raise serializers.ValidationError(
                    {"limit": "Limit must be an integer between 1 and 100."}
                ) from exc
            snapshots = snapshots[:limit]
        serializer = EntityAuthoritySnapshotSerializer(snapshots, many=True)
        return Response(serializer.data)


@document_project_owned_viewset(
    resource_plural="entity candidates",
    resource_singular="entity candidate",
    create_description="Entity candidates are created by the pipeline and can be reviewed through dedicated actions.",
    tag="Entity Catalog",
    action_overrides=build_crud_action_overrides(
        EntityCandidateSerializer,
        resource_plural="entity candidates for the selected project",
        resource_singular="entity candidate",
    ),
)
class EntityCandidateViewSet(ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Inspect and resolve entity candidates surfaced by entity extraction."""

    serializer_class = EntityCandidateSerializer
    queryset = EntityCandidate.objects.select_related(
        "project", "first_seen_in", "merged_into"
    )

    def get_permissions(self):
        """Allow all members to read candidates and contributors to resolve them."""

        if self.action in {"accept", "reject", "merge"}:
            permission_classes = [IsProjectContributor]
        else:
            permission_classes = [IsProjectMember]
        return [permission() for permission in permission_classes]

    @extend_schema(
        summary="Accept entity candidate",
        description="Promote a pending entity candidate into a tracked entity and backfill recent mentions.",
        request=None,
        responses={
            200: EntityCandidateSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Entity Catalog"],
    )
    @action(detail=True, methods=["post"], url_path="accept")
    def accept(self, request, *args, **kwargs):
        """Accept an entity candidate and return its updated representation."""

        candidate = self.get_object()
        accept_entity_candidate(candidate)
        candidate.refresh_from_db()
        serializer = self.get_serializer(candidate)
        return Response(serializer.data)

    @extend_schema(
        summary="Reject entity candidate",
        description="Mark a pending entity candidate as rejected without creating a tracked entity.",
        request=None,
        responses={
            200: EntityCandidateSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Entity Catalog"],
    )
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        """Reject an entity candidate and return its updated representation."""

        candidate = self.get_object()
        reject_entity_candidate(candidate)
        candidate.refresh_from_db()
        serializer = self.get_serializer(candidate)
        return Response(serializer.data)

    @extend_schema(
        summary="Merge entity candidate",
        description="Merge a pending entity candidate into an existing tracked entity from the same project.",
        request=EntityCandidateMergeSerializer,
        responses={
            200: EntityCandidateSerializer,
            400: EntityCandidateMergeSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
        tags=["Entity Catalog"],
    )
    @action(detail=True, methods=["post"], url_path="merge")
    def merge(self, request, *args, **kwargs):
        """Merge an entity candidate into an existing tracked entity."""

        candidate = self.get_object()
        serializer = EntityCandidateMergeSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        merge_entity_candidate(candidate, serializer.validated_data["merged_into"])
        candidate.refresh_from_db()
        response_serializer = self.get_serializer(candidate)
        return Response(response_serializer.data)
