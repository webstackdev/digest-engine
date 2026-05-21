"""Django Ninja endpoints for project-scoped entity resources."""

from __future__ import annotations

import datetime
from typing import Any, cast

from django.db.models import Count, Prefetch, QuerySet
from ninja import Path, Query, Router, Schema
from ninja.errors import HttpError
from rest_framework import serializers

from entities.extraction import (
    accept_entity_candidate,
    merge_entity_candidate,
    reject_entity_candidate,
)
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityMention,
)
from entities.serializers import (
    EntityAuthoritySnapshotSerializer,
    EntityCandidateMergeSerializer,
    EntityCandidateSerializer,
    EntityMentionSummarySerializer,
    EntitySerializer,
)
from core.ninja_api import drf_authenticate
from projects.ninja_api import (
    _get_project_or_404,
    _require_project_admin,
    _require_project_writable,
)

entity_router = Router(tags=["Entity Catalog"])
entity_candidate_router = Router(tags=["Entity Catalog"])

ENTITY_ORDERING_FIELDS = {"authority_score", "created_at", "name"}


class EntityIdentityClaimSchema(Schema):
    """Serialized external identity claim payload."""

    id: int
    surface: str
    claim_url: str
    verified: bool
    verified_at: datetime.datetime | None = None
    verification_method: str


class EntityMentionSummarySchema(Schema):
    """Serialized compact entity mention payload."""

    id: int
    content_id: int
    content_title: str
    role: str
    sentiment: str
    span: str
    confidence: float
    created_at: datetime.datetime


class EntitySchema(Schema):
    """Serialized tracked entity payload."""

    id: int
    project: int
    name: str
    type: str
    description: str
    authority_score: float
    website_url: str
    github_url: str
    linkedin_url: str
    bluesky_handle: str
    mastodon_handle: str
    twitter_handle: str
    identity_claims: list[EntityIdentityClaimSchema]
    mention_count: int
    latest_mentions: list[EntityMentionSummarySchema]
    created_at: datetime.datetime


class EntityCreateInput(Schema):
    """Writable entity fields for create requests."""

    name: str
    type: str
    description: str = ""
    authority_score: float | None = None
    website_url: str = ""
    github_url: str = ""
    linkedin_url: str = ""
    bluesky_handle: str = ""
    mastodon_handle: str = ""
    twitter_handle: str = ""
    project: int | None = None


class EntityUpdateInput(Schema):
    """Writable entity fields for update requests."""

    name: str | None = None
    type: str | None = None
    description: str | None = None
    authority_score: float | None = None
    website_url: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    bluesky_handle: str | None = None
    mastodon_handle: str | None = None
    twitter_handle: str | None = None
    project: int | None = None


class EntityAuthoritySnapshotSchema(Schema):
    """Serialized entity authority snapshot payload."""

    id: int
    entity: int
    project: int
    computed_at: datetime.datetime
    mention_component: float
    engagement_component: float
    recency_component: float
    source_quality_component: float
    cross_newsletter_component: float
    feedback_component: float
    duplicate_component: float
    decayed_prior: float
    weights_at_compute: dict[str, Any]
    final_score: float


class EntityCandidateSchema(Schema):
    """Serialized entity candidate payload."""

    id: int
    project: int
    name: str
    suggested_type: str
    first_seen_in: int | None = None
    first_seen_title: str | None = None
    occurrence_count: int
    cluster_key: str
    auto_promotion_blocked_reason: str
    evidence_count: int
    source_plugin_count: int
    source_plugins: list[str]
    identity_surfaces: list[str]
    status: str
    merged_into: int | None = None
    merged_into_name: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class EntityCandidateMergeInput(Schema):
    """Writable merge payload for one entity candidate."""

    merged_into: int


def _entity_queryset() -> QuerySet[Entity]:
    """Return the canonical queryset used by entity endpoints."""

    return (
        Entity.objects.select_related("project")
        .annotate(mention_count=Count("mentions", distinct=True))
        .prefetch_related("identity_claims")
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


def _entity_candidate_queryset() -> QuerySet[EntityCandidate]:
    """Return the canonical queryset used by entity-candidate endpoints."""

    return EntityCandidate.objects.select_related(
        "project", "first_seen_in", "merged_into"
    ).prefetch_related("evidence")


def _serialize_entity(entity: Entity) -> dict[str, Any]:
    """Return one entity response body."""

    return cast(dict[str, Any], EntitySerializer(entity).data)


def _serialize_entity_mention(mention: EntityMention) -> dict[str, Any]:
    """Return one entity mention response body."""

    return cast(dict[str, Any], EntityMentionSummarySerializer(mention).data)


def _serialize_authority_snapshot(snapshot: EntityAuthoritySnapshot) -> dict[str, Any]:
    """Return one entity authority snapshot response body."""

    return cast(dict[str, Any], EntityAuthoritySnapshotSerializer(snapshot).data)


def _serialize_entity_candidate(candidate: EntityCandidate) -> dict[str, Any]:
    """Return one entity candidate response body."""

    return cast(dict[str, Any], EntityCandidateSerializer(candidate).data)


def _get_entity_or_404(project_id: int, entity_id: int) -> Entity:
    """Load one entity for the selected project."""

    entity = _entity_queryset().filter(project_id=project_id, pk=entity_id).first()
    if not entity:
        raise HttpError(404, "Not found.")
    return entity


def _get_entity_candidate_or_404(project_id: int, candidate_id: int) -> EntityCandidate:
    """Load one entity candidate for the selected project."""

    candidate = (
        _entity_candidate_queryset()
        .filter(
            project_id=project_id,
            pk=candidate_id,
        )
        .first()
    )
    if not candidate:
        raise HttpError(404, "Not found.")
    return candidate


def _apply_entity_ordering(
    queryset: QuerySet[Entity], ordering: str | None
) -> QuerySet[Entity]:
    """Apply supported ordering fields to the entity queryset."""

    if not ordering:
        return queryset.order_by("name")
    field_name = ordering.lstrip("-")
    if field_name not in ENTITY_ORDERING_FIELDS:
        return queryset.order_by("name")
    return queryset.order_by(ordering)


@entity_router.get("/", response=list[EntitySchema], auth=drf_authenticate)
def list_entities(
    request: Any,
    project_id: int = Path(...),
    ordering: str | None = Query(None),
):
    """List tracked entities visible to the current project member."""

    _get_project_or_404(request, project_id)
    entities = _apply_entity_ordering(
        _entity_queryset().filter(project_id=project_id),
        ordering,
    )
    return [_serialize_entity(entity) for entity in entities]


@entity_router.post("/", response={201: EntitySchema}, auth=drf_authenticate)
def create_entity(
    request: Any,
    payload: EntityCreateInput,
    project_id: int = Path(...),
):
    """Create one tracked entity under the selected project."""

    project = _require_project_writable(request, project_id)
    serializer = EntitySerializer(
        data=payload.model_dump(exclude_unset=True, exclude_none=False),
        context={"project": project, "request": request},
    )
    serializer.is_valid(raise_exception=True)
    entity = serializer.save(project=project)
    return 201, _serialize_entity(_get_entity_or_404(project_id, cast(int, entity.pk)))


@entity_router.get("/{entity_id}/", response=EntitySchema, auth=drf_authenticate)
def get_entity(
    request: Any,
    project_id: int = Path(...),
    entity_id: int = Path(...),
):
    """Return one tracked entity."""

    _get_project_or_404(request, project_id)
    return _serialize_entity(_get_entity_or_404(project_id, entity_id))


@entity_router.patch("/{entity_id}/", response=EntitySchema, auth=drf_authenticate)
def update_entity(
    request: Any,
    payload: EntityUpdateInput,
    project_id: int = Path(...),
    entity_id: int = Path(...),
):
    """Update one tracked entity."""

    _require_project_writable(request, project_id)
    entity = _get_entity_or_404(project_id, entity_id)
    serializer = EntitySerializer(
        entity,
        data=payload.model_dump(exclude_unset=True, exclude_none=False),
        partial=True,
        context={"project": entity.project, "request": request},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_entity(_get_entity_or_404(project_id, entity_id))


@entity_router.delete("/{entity_id}/", response={204: None}, auth=drf_authenticate)
def delete_entity(
    request: Any,
    project_id: int = Path(...),
    entity_id: int = Path(...),
):
    """Delete one tracked entity."""

    _require_project_admin(request, project_id)
    entity = _get_entity_or_404(project_id, entity_id)
    entity.delete()
    return 204, None


@entity_router.get(
    "/{entity_id}/mentions/",
    response=list[EntityMentionSummarySchema],
    auth=drf_authenticate,
)
def entity_mentions(
    request: Any,
    project_id: int = Path(...),
    entity_id: int = Path(...),
):
    """Return extracted mention history for one tracked entity."""

    _get_project_or_404(request, project_id)
    entity = _get_entity_or_404(project_id, entity_id)
    mentions = entity.mentions.select_related("content").order_by("-created_at")
    return [_serialize_entity_mention(mention) for mention in mentions]


@entity_router.get(
    "/{entity_id}/authority_components/",
    response=EntityAuthoritySnapshotSchema,
    auth=drf_authenticate,
)
def entity_authority_components(
    request: Any,
    project_id: int = Path(...),
    entity_id: int = Path(...),
):
    """Return the latest authority snapshot for one tracked entity."""

    _get_project_or_404(request, project_id)
    entity = _get_entity_or_404(project_id, entity_id)
    snapshot = entity.authority_snapshots.order_by("-computed_at").first()
    if snapshot is None:
        raise HttpError(404, "No authority snapshots exist for this entity yet.")
    return _serialize_authority_snapshot(snapshot)


@entity_router.get(
    "/{entity_id}/authority_history/",
    response=list[EntityAuthoritySnapshotSchema],
    auth=drf_authenticate,
)
def entity_authority_history(
    request: Any,
    project_id: int = Path(...),
    entity_id: int = Path(...),
    limit: str | None = Query(None),
):
    """Return recent authority snapshots for one tracked entity."""

    _get_project_or_404(request, project_id)
    entity = _get_entity_or_404(project_id, entity_id)
    snapshots = entity.authority_snapshots.order_by("-computed_at")
    if limit is not None:
        try:
            parsed_limit = int(limit)
        except ValueError as exc:
            raise serializers.ValidationError(
                {"limit": "Limit must be an integer between 1 and 100."}
            ) from exc
        if parsed_limit < 1 or parsed_limit > 100:
            raise serializers.ValidationError(
                {"limit": "Limit must be an integer between 1 and 100."}
            )
        snapshots = snapshots[:parsed_limit]
    return [_serialize_authority_snapshot(snapshot) for snapshot in snapshots]


@entity_candidate_router.get(
    "/",
    response=list[EntityCandidateSchema],
    auth=drf_authenticate,
)
def list_entity_candidates(request: Any, project_id: int = Path(...)):
    """List entity candidates visible to the current project member."""

    _get_project_or_404(request, project_id)
    candidates = _entity_candidate_queryset().filter(project_id=project_id)
    return [_serialize_entity_candidate(candidate) for candidate in candidates]


@entity_candidate_router.get(
    "/{candidate_id}/",
    response=EntityCandidateSchema,
    auth=drf_authenticate,
)
def get_entity_candidate(
    request: Any,
    project_id: int = Path(...),
    candidate_id: int = Path(...),
):
    """Return one entity candidate."""

    _get_project_or_404(request, project_id)
    return _serialize_entity_candidate(
        _get_entity_candidate_or_404(project_id, candidate_id)
    )


@entity_candidate_router.post(
    "/{candidate_id}/accept/",
    response=EntityCandidateSchema,
    auth=drf_authenticate,
)
def accept_entity_candidate_route(
    request: Any,
    project_id: int = Path(...),
    candidate_id: int = Path(...),
):
    """Accept one entity candidate and return its updated representation."""

    _require_project_writable(request, project_id)
    candidate = _get_entity_candidate_or_404(project_id, candidate_id)
    accept_entity_candidate(candidate, schedule_enrichment=True)
    candidate.refresh_from_db()
    return _serialize_entity_candidate(
        _get_entity_candidate_or_404(project_id, candidate_id)
    )


@entity_candidate_router.post(
    "/{candidate_id}/reject/",
    response=EntityCandidateSchema,
    auth=drf_authenticate,
)
def reject_entity_candidate_route(
    request: Any,
    project_id: int = Path(...),
    candidate_id: int = Path(...),
):
    """Reject one entity candidate and return its updated representation."""

    _require_project_writable(request, project_id)
    candidate = _get_entity_candidate_or_404(project_id, candidate_id)
    reject_entity_candidate(candidate)
    candidate.refresh_from_db()
    return _serialize_entity_candidate(
        _get_entity_candidate_or_404(project_id, candidate_id)
    )


@entity_candidate_router.post(
    "/{candidate_id}/merge/",
    response=EntityCandidateSchema,
    auth=drf_authenticate,
)
def merge_entity_candidate_route(
    request: Any,
    payload: EntityCandidateMergeInput,
    project_id: int = Path(...),
    candidate_id: int = Path(...),
):
    """Merge one entity candidate into an existing tracked entity."""

    _require_project_writable(request, project_id)
    candidate = _get_entity_candidate_or_404(project_id, candidate_id)
    serializer = EntityCandidateMergeSerializer(
        data=payload.model_dump(exclude_unset=True),
        context={"project": candidate.project, "request": request},
    )
    serializer.is_valid(raise_exception=True)
    merge_entity_candidate(
        candidate,
        serializer.validated_data["merged_into"],
        schedule_enrichment=True,
    )
    candidate.refresh_from_db()
    return _serialize_entity_candidate(
        _get_entity_candidate_or_404(project_id, candidate_id)
    )


__all__ = ["entity_router", "entity_candidate_router"]
