"""Celery tasks and helpers for automated entity discovery."""

from __future__ import annotations

import html
import logging
import re
from collections import defaultdict
from dataclasses import dataclass
from difflib import SequenceMatcher
from hashlib import sha1
from itertools import combinations
from math import sqrt
from typing import Any, Protocol, cast
from urllib.parse import urlsplit
from uuid import NAMESPACE_URL, uuid5

import httpx
from atproto import Client
from celery import shared_task
from django.conf import settings
from django.db.models import Model
from django.utils import timezone
from django.utils.html import strip_tags
from django.utils.text import slugify
from mastodon import Mastodon

from core.embeddings import build_entity_embedding_text, embed_text
from core.llm import openrouter_chat_json
from entities.extraction import (
    _normalize_name,
    accept_entity_candidate,
    merge_entity_candidate,
)
from entities.models import (
    Entity,
    EntityCandidate,
    EntityCandidateStatus,
    EntityIdentityClaim,
    IdentitySurface,
)
from ingestion.plugins.bluesky import PUBLIC_APPVIEW_BASE_URL
from ingestion.plugins.mastodon import MastodonSourcePlugin
from pipeline.resilience import ResilientSkillError, execute_with_resilience
from projects.model_support import (
    normalize_bluesky_handle,
    normalize_linkedin_url,
    normalize_mastodon_handle,
)
from projects.models import Project

logger = logging.getLogger(__name__)

AUTO_PROMOTION_MIN_OCCURRENCES = 5
AUTO_PROMOTION_MIN_DISTINCT_SOURCES = 2
AUTO_PROMOTION_MIN_CONFIDENCE = 0.85
ENTITY_MATCH_SIMILARITY_THRESHOLD = 0.92
CANDIDATE_CLUSTER_SIMILARITY_THRESHOLD = 0.78
MAX_CANDIDATE_CONTEXTS = 5
IDENTITY_CONFLICT_FIELDS = {
    "github_url",
    "linkedin_url",
    "website_url",
    "bluesky_handle",
    "mastodon_handle",
}
GITHUB_API_BASE_URL = "https://api.github.com"
HTML_TITLE_PATTERN = re.compile(
    r"<title>(?P<title>.*?)</title>", re.IGNORECASE | re.DOTALL
)


@dataclass(slots=True)
class IdentityProbeResult:
    """Normalized result from probing one external identity surface."""

    claim_url: str
    verification_method: str
    field_updates: dict[str, str]


class DelayedTask(Protocol):
    """Protocol for Celery tasks that can run eagerly or via ``delay``."""

    def __call__(self, *args: object, **kwargs: object) -> object:
        pass

    def delay(self, *args: object, **kwargs: object) -> object:
        pass


def _enqueue_task(task: object, *args: object) -> None:
    """Dispatch a Celery task through a typed ``delay`` seam."""

    cast(DelayedTask, task).delay(*args)


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key as an ``int``."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


@shared_task(name="entities.tasks.run_all_entity_candidate_clustering")
def run_all_entity_candidate_clustering() -> int:
    """Queue candidate clustering for every project."""

    project_ids = list(Project.objects.values_list("id", flat=True))
    for project_id in project_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            cluster_entity_candidates(project_id)
        else:
            _enqueue_task(cluster_entity_candidates, project_id)
    return len(project_ids)


@shared_task(name="entities.tasks.run_all_entity_candidate_auto_promotions")
def run_all_entity_candidate_auto_promotions() -> int:
    """Queue automated candidate promotion checks for every project."""

    project_ids = list(Project.objects.values_list("id", flat=True))
    for project_id in project_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            auto_promote_entity_candidates(project_id)
        else:
            _enqueue_task(auto_promote_entity_candidates, project_id)
    return len(project_ids)


@shared_task(name="entities.tasks.cluster_entity_candidates")
def cluster_entity_candidates(project_id: int) -> dict[str, int]:
    """Assign stable cluster keys to pending candidates inside one project."""

    candidates = list(
        EntityCandidate.objects.filter(
            project_id=project_id,
            status=EntityCandidateStatus.PENDING,
        )
        .select_related("first_seen_in")
        .prefetch_related("evidence")
        .order_by("name")
    )
    if not candidates:
        return {
            "project_id": project_id,
            "clusters_created": 0,
            "candidates_updated": 0,
        }

    texts = {
        _require_pk(candidate): _candidate_embedding_text(candidate)
        for candidate in candidates
    }
    vectors = _candidate_vectors(texts)
    groups = _candidate_groups(candidates, texts, vectors)

    candidates_updated = 0
    for group in groups:
        cluster_key = _cluster_key_for_group(group)
        for candidate in group:
            contextual_embedding_id = uuid5(
                NAMESPACE_URL,
                f"entity-candidate:{_require_pk(candidate)}:{texts[_require_pk(candidate)]}",
            )
            update_fields: list[str] = []
            if candidate.cluster_key != cluster_key:
                candidate.cluster_key = cluster_key
                update_fields.append("cluster_key")
            if candidate.contextual_embedding_id != contextual_embedding_id:
                candidate.contextual_embedding_id = contextual_embedding_id
                update_fields.append("contextual_embedding_id")
            if update_fields:
                candidate.save(update_fields=update_fields + ["updated_at"])
                candidates_updated += 1

    return {
        "project_id": project_id,
        "clusters_created": len(groups),
        "candidates_updated": candidates_updated,
    }


@shared_task(name="entities.tasks.auto_promote_entity_candidates")
def auto_promote_entity_candidates(project_id: int) -> dict[str, int]:
    """Promote or merge pending candidates that meet the WP2 thresholds."""

    candidates = list(
        EntityCandidate.objects.filter(
            project_id=project_id,
            status=EntityCandidateStatus.PENDING,
        )
        .select_related("project", "first_seen_in")
        .prefetch_related("evidence")
        .order_by("-occurrence_count", "name")
    )
    entities = list(Entity.objects.filter(project_id=project_id).order_by("name"))
    if not candidates:
        return {
            "project_id": project_id,
            "promoted": 0,
            "merged": 0,
            "blocked": 0,
        }

    promoted = 0
    merged = 0
    blocked = 0
    for candidate in candidates:
        exact_match = _exact_matching_entity(candidate, entities)
        if exact_match is not None:
            merge_entity_candidate(candidate, exact_match, schedule_enrichment=True)
            merged += 1
            continue

        blocked_reason = _candidate_blocked_reason(candidate)
        if not blocked_reason:
            best_match, similarity = _best_existing_entity_match(candidate, entities)
            if (
                best_match is not None
                and similarity >= ENTITY_MATCH_SIMILARITY_THRESHOLD
            ):
                blocked_reason = "matches_existing_entity"

        if blocked_reason:
            blocked += 1
            if candidate.auto_promotion_blocked_reason != blocked_reason:
                candidate.auto_promotion_blocked_reason = blocked_reason
                candidate.save(
                    update_fields=["auto_promotion_blocked_reason", "updated_at"]
                )
            continue

        entity = accept_entity_candidate(candidate, schedule_enrichment=True)
        entities.append(entity)
        promoted += 1

    return {
        "project_id": project_id,
        "promoted": promoted,
        "merged": merged,
        "blocked": blocked,
    }


@shared_task(name="entities.tasks.enrich_entity_identity")
def enrich_entity_identity(entity_id: int) -> dict[str, Any]:
    """Project verified identity claims back onto the tracked entity fields."""

    entity = (
        Entity.objects.filter(pk=entity_id)
        .prefetch_related("identity_claims")
        .select_related("project")
        .get()
    )
    claims = list(
        entity.identity_claims.filter(verified=True).order_by("surface", "claim_url")
    )
    if not claims:
        return {"entity_id": entity_id, "claims_considered": 0, "fields_updated": 0}

    fields_updated = 0
    updated_fields: set[str] = set()
    for claim in claims:
        try:
            probe_result = _probe_identity_claim(entity, claim)
        except Exception:
            logger.exception(
                "Failed to probe identity claim id=%s for entity id=%s surface=%s",
                _require_pk(claim),
                entity_id,
                claim.surface,
            )
            continue

        _update_claim_from_probe(claim, probe_result)
        for field_name, field_value in probe_result.field_updates.items():
            if not field_name or not field_value:
                continue
            if field_name in IDENTITY_CONFLICT_FIELDS and _claim_conflicts(
                entity, field_name, field_value
            ):
                logger.warning(
                    "Skipping conflicting identity claim for entity id=%s field=%s value=%s",
                    entity_id,
                    field_name,
                    field_value,
                )
                continue
            if field_name in {"website_url", "description"} and getattr(
                entity, field_name
            ):
                continue
            if _entity_field_matches(entity, field_name, field_value):
                continue
            setattr(entity, field_name, field_value)
            updated_fields.add(field_name)
            fields_updated += 1

    if updated_fields:
        entity.save(update_fields=sorted(updated_fields))

    return {
        "entity_id": entity_id,
        "claims_considered": len(claims),
        "fields_updated": fields_updated,
    }


def _probe_identity_claim(
    entity: Entity,
    claim: EntityIdentityClaim,
) -> IdentityProbeResult:
    """Probe one identity claim and return canonicalized field updates."""

    if claim.surface == IdentitySurface.GITHUB:
        return _probe_github_claim(claim)
    if claim.surface == IdentitySurface.BLUESKY:
        return _probe_bluesky_claim(claim)
    if claim.surface == IdentitySurface.MASTODON:
        return _probe_mastodon_claim(claim)
    if claim.surface == IdentitySurface.LINKEDIN:
        return _probe_linkedin_claim(claim)
    if claim.surface == IdentitySurface.WEBSITE:
        return _probe_website_claim(claim)
    return _default_probe_result_from_claim(claim)


def _probe_github_claim(claim: EntityIdentityClaim) -> IdentityProbeResult:
    """Probe the GitHub users API for one stored profile claim."""

    github_login = _github_login_from_claim_url(claim.claim_url)
    if not github_login:
        return _default_probe_result_from_claim(claim)
    response = httpx.get(
        f"{GITHUB_API_BASE_URL}/users/{github_login}",
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": settings.OPENROUTER_APP_NAME or "digest-engine",
        },
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("GitHub profile probe must return a JSON object.")

    field_updates = {
        "github_url": str(payload.get("html_url") or claim.claim_url)
        .strip()
        .rstrip("/"),
    }
    blog_url = str(payload.get("blog") or "").strip()
    if blog_url:
        field_updates["website_url"] = blog_url.rstrip("/")
    description = _github_description(payload)
    if description:
        field_updates["description"] = description
    return IdentityProbeResult(
        claim_url=field_updates["github_url"],
        verification_method="github_api",
        field_updates=field_updates,
    )


def _probe_bluesky_claim(claim: EntityIdentityClaim) -> IdentityProbeResult:
    """Probe the Bluesky AppView profile API for one stored handle claim."""

    handle = _bluesky_handle_from_claim(claim.claim_url)
    if not handle:
        return _default_probe_result_from_claim(claim)

    client = Client(base_url=PUBLIC_APPVIEW_BASE_URL)
    profile = client.app.bsky.actor.get_profile({"actor": handle})
    canonical_handle = normalize_bluesky_handle(
        str(getattr(profile, "handle", "") or handle)
    )
    field_updates = {"bluesky_handle": canonical_handle}
    description = str(getattr(profile, "description", "") or "").strip()
    if description:
        field_updates["description"] = description
    return IdentityProbeResult(
        claim_url=f"https://bsky.app/profile/{canonical_handle}",
        verification_method="bluesky_appview",
        field_updates=field_updates,
    )


def _probe_mastodon_claim(claim: EntityIdentityClaim) -> IdentityProbeResult:
    """Probe the Mastodon account lookup API for one stored profile claim."""

    canonical_handle = _mastodon_handle_from_claim(claim.claim_url)
    if not canonical_handle:
        return _default_probe_result_from_claim(claim)
    parsed_claim = urlsplit(claim.claim_url)
    instance_url = f"{parsed_claim.scheme or 'https'}://{parsed_claim.netloc}"
    client = Mastodon(api_base_url=instance_url)
    account = client.account_lookup(canonical_handle)
    verified_handle = MastodonSourcePlugin._account_acct(
        account,
        instance_url=instance_url,
    )
    account_url = str(MastodonSourcePlugin._nested_value(account, "url") or "").strip()
    note_html = str(MastodonSourcePlugin._nested_value(account, "note") or "").strip()

    field_updates = {"mastodon_handle": verified_handle}
    description = html.unescape(strip_tags(note_html)).strip()
    if description:
        field_updates["description"] = description
    return IdentityProbeResult(
        claim_url=account_url or claim.claim_url,
        verification_method="mastodon_account_lookup",
        field_updates=field_updates,
    )


def _probe_linkedin_claim(claim: EntityIdentityClaim) -> IdentityProbeResult:
    """Probe one LinkedIn public profile URL and canonicalize redirects."""

    response = httpx.get(claim.claim_url, follow_redirects=True, timeout=20)
    response.raise_for_status()
    canonical_url = normalize_linkedin_url(str(response.url))
    field_updates = {"linkedin_url": canonical_url}
    description = _html_title(response.text)
    if description:
        field_updates["description"] = description
    return IdentityProbeResult(
        claim_url=canonical_url,
        verification_method="linkedin_profile_url",
        field_updates=field_updates,
    )


def _probe_website_claim(claim: EntityIdentityClaim) -> IdentityProbeResult:
    """Probe one website claim and normalize the final origin URL."""

    response = httpx.get(claim.claim_url, follow_redirects=True, timeout=20)
    response.raise_for_status()
    final_url = str(response.url).rstrip("/")
    parsed_url = urlsplit(final_url)
    canonical_origin = f"{parsed_url.scheme.lower()}://{parsed_url.netloc.lower()}"
    return IdentityProbeResult(
        claim_url=canonical_origin,
        verification_method="website_http_probe",
        field_updates={"website_url": canonical_origin},
    )


def _default_probe_result_from_claim(claim: EntityIdentityClaim) -> IdentityProbeResult:
    """Return the current claim mapping when no richer live probe exists."""

    field_name, field_value = _entity_field_value_from_claim(claim)
    field_updates = {field_name: field_value} if field_name and field_value else {}
    return IdentityProbeResult(
        claim_url=claim.claim_url,
        verification_method=claim.verification_method or "candidate_evidence",
        field_updates=field_updates,
    )


def _update_claim_from_probe(
    claim: EntityIdentityClaim,
    probe_result: IdentityProbeResult,
) -> None:
    """Persist canonical claim details after a successful live probe."""

    update_fields: list[str] = []
    if claim.claim_url != probe_result.claim_url:
        claim.claim_url = probe_result.claim_url
        update_fields.append("claim_url")
    if claim.verification_method != probe_result.verification_method:
        claim.verification_method = probe_result.verification_method
        update_fields.append("verification_method")
    if not claim.verified:
        claim.verified = True
        update_fields.append("verified")
    if claim.verified_at is None:
        claim.verified_at = timezone.now()
        update_fields.append("verified_at")
    if update_fields:
        claim.save(update_fields=update_fields)


def _entity_field_matches(entity: Entity, field_name: str, field_value: str) -> bool:
    """Return whether the entity already stores the normalized field value."""

    existing_value = getattr(entity, field_name)
    if field_name in IDENTITY_CONFLICT_FIELDS:
        return _normalized_field_value(
            field_name, existing_value
        ) == _normalized_field_value(field_name, field_value)
    return str(existing_value).strip() == str(field_value).strip()


def _github_login_from_claim_url(claim_url: str) -> str:
    """Extract the GitHub login from a stored claim URL."""

    path_parts = [part for part in urlsplit(claim_url).path.split("/") if part]
    if not path_parts:
        return ""
    return path_parts[0]


def _github_description(payload: dict[str, Any]) -> str:
    """Build a short description from the GitHub profile payload."""

    description_parts = [
        str(payload.get("name") or "").strip(),
        str(payload.get("bio") or "").strip(),
        str(payload.get("company") or "").strip(),
        str(payload.get("location") or "").strip(),
    ]
    return " - ".join(part for part in description_parts if part)[:500]


def _html_title(response_text: str) -> str:
    """Extract a readable page title from HTML when one is present."""

    match = HTML_TITLE_PATTERN.search(response_text or "")
    if match is None:
        return ""
    return html.unescape(strip_tags(match.group("title"))).strip()[:500]


def _candidate_vectors(texts: dict[int, str]) -> dict[int, list[float]]:
    """Embed candidate cluster texts when the embedding backend is available."""

    vectors: dict[int, list[float]] = {}
    for candidate_id, text in texts.items():
        try:
            vectors[candidate_id] = embed_text(text)
        except Exception:
            logger.exception(
                "Failed to embed entity candidate id=%s for clustering", candidate_id
            )
            vectors[candidate_id] = []
    return vectors


def _candidate_groups(
    candidates: list[EntityCandidate],
    texts: dict[int, str],
    vectors: dict[int, list[float]],
) -> list[list[EntityCandidate]]:
    """Build candidate groups from name and context similarity."""

    parents = {
        _require_pk(candidate): _require_pk(candidate) for candidate in candidates
    }

    def find(candidate_id: int) -> int:
        parent_id = parents[candidate_id]
        if parent_id != candidate_id:
            parents[candidate_id] = find(parent_id)
        return parents[candidate_id]

    def union(first_id: int, second_id: int) -> None:
        first_root = find(first_id)
        second_root = find(second_id)
        if first_root != second_root:
            parents[second_root] = first_root

    for first_candidate, second_candidate in combinations(candidates, 2):
        first_id = _require_pk(first_candidate)
        second_id = _require_pk(second_candidate)
        similarity = _candidate_pair_similarity(
            first_candidate,
            second_candidate,
            texts[first_id],
            texts[second_id],
            vectors.get(first_id, []),
            vectors.get(second_id, []),
        )
        if similarity >= CANDIDATE_CLUSTER_SIMILARITY_THRESHOLD:
            union(first_id, second_id)

    grouped_candidates: dict[int, list[EntityCandidate]] = defaultdict(list)
    for candidate in candidates:
        grouped_candidates[find(_require_pk(candidate))].append(candidate)
    return [
        sorted(group, key=lambda row: (-row.occurrence_count, row.name.casefold()))
        for group in grouped_candidates.values()
    ]


def _candidate_pair_similarity(
    first_candidate: EntityCandidate,
    second_candidate: EntityCandidate,
    first_text: str,
    second_text: str,
    first_vector: list[float],
    second_vector: list[float],
) -> float:
    """Return the strongest available similarity signal for two candidates."""

    normalized_first = _normalize_name(first_candidate.name)
    normalized_second = _normalize_name(second_candidate.name)
    name_similarity = SequenceMatcher(None, normalized_first, normalized_second).ratio()
    token_similarity = _token_similarity(normalized_first, normalized_second)
    vector_similarity = _cosine_similarity(first_vector, second_vector)
    context_similarity = SequenceMatcher(None, first_text, second_text).ratio()
    return max(name_similarity, token_similarity, vector_similarity, context_similarity)


def _token_similarity(first_value: str, second_value: str) -> float:
    """Return a Jaccard-like overlap score for normalized token sets."""

    first_tokens = {token for token in first_value.split() if token}
    second_tokens = {token for token in second_value.split() if token}
    if not first_tokens or not second_tokens:
        return 0.0
    intersection = len(first_tokens & second_tokens)
    union = len(first_tokens | second_tokens)
    return intersection / union if union else 0.0


def _cosine_similarity(first_vector: list[float], second_vector: list[float]) -> float:
    """Return cosine similarity for two dense vectors."""

    if not first_vector or not second_vector or len(first_vector) != len(second_vector):
        return 0.0
    numerator = sum(
        first * second for first, second in zip(first_vector, second_vector)
    )
    first_magnitude = sqrt(sum(value * value for value in first_vector))
    second_magnitude = sqrt(sum(value * value for value in second_vector))
    if not first_magnitude or not second_magnitude:
        return 0.0
    return numerator / (first_magnitude * second_magnitude)


def _cluster_key_for_group(group: list[EntityCandidate]) -> str:
    """Build a stable cluster label for a candidate group."""

    primary_name = group[0].name
    name_slug = slugify(primary_name)[:40] or "candidate"
    digest = sha1(
        ",".join(str(_require_pk(candidate)) for candidate in group).encode("utf-8")
    ).hexdigest()[:8]
    return f"{name_slug}-{digest}"[:64]


def _candidate_embedding_text(candidate: EntityCandidate) -> str:
    """Build the combined name, identity, and context text for one candidate."""

    evidence_rows = list(candidate.evidence.all()[:MAX_CANDIDATE_CONTEXTS])
    claim_urls = [row.claim_url for row in evidence_rows if row.claim_url]
    context_lines = [
        row.context_excerpt for row in evidence_rows if row.context_excerpt
    ]
    return "\n\n".join(
        part
        for part in [
            candidate.name,
            candidate.suggested_type,
            *claim_urls,
            *context_lines,
        ]
        if part
    )


def _candidate_blocked_reason(candidate: EntityCandidate) -> str:
    """Return the first auto-promotion blocker for a candidate."""

    if candidate.occurrence_count < AUTO_PROMOTION_MIN_OCCURRENCES:
        return "needs_more_occurrences"
    distinct_sources = (
        candidate.evidence.values_list("source_plugin", flat=True).distinct().count()
    )
    if distinct_sources < AUTO_PROMOTION_MIN_DISTINCT_SOURCES:
        return "needs_more_source_diversity"
    if not _candidate_has_verified_identity(candidate):
        return "missing_verified_identity"
    if _candidate_disambiguation_confidence(candidate) < AUTO_PROMOTION_MIN_CONFIDENCE:
        return "low_disambiguation_confidence"
    return ""


def _candidate_has_verified_identity(candidate: EntityCandidate) -> bool:
    """Return whether the candidate has at least one verified identity hint."""

    return (
        candidate.evidence.exclude(identity_surface="").exclude(claim_url="").exists()
    )


def _candidate_disambiguation_confidence(candidate: EntityCandidate) -> float:
    """Score how likely the candidate refers to one stable real-world entity."""

    evidence_rows = list(candidate.evidence.all()[:MAX_CANDIDATE_CONTEXTS])
    if not evidence_rows:
        return 0.0
    if not settings.OPENROUTER_API_KEY:
        return _heuristic_candidate_confidence(candidate, evidence_rows)

    try:
        response = execute_with_resilience(
            "entity_extraction",
            lambda: openrouter_chat_json(
                model=settings.AI_CLASSIFICATION_MODEL,
                system_prompt=(
                    "You validate whether an extracted entity candidate refers to one "
                    "stable real-world entity that is safe to auto-promote. "
                    "Return JSON with confidence (0 to 1) and explanation."
                ),
                user_prompt=_candidate_disambiguation_prompt(candidate, evidence_rows),
            ),
            use_circuit_breaker=True,
        )
    except ResilientSkillError:
        logger.exception(
            "Falling back to heuristic candidate confidence for candidate id=%s",
            _require_pk(candidate),
        )
        return _heuristic_candidate_confidence(candidate, evidence_rows)
    return _clamp_unit_interval(response.payload.get("confidence", 0.0))


def _candidate_disambiguation_prompt(
    candidate: EntityCandidate,
    evidence_rows: list[Any],
) -> str:
    """Build the JSON-oriented prompt for candidate promotion confidence."""

    evidence_payload = [
        {
            "source_plugin": evidence.source_plugin,
            "context_excerpt": evidence.context_excerpt,
            "identity_surface": evidence.identity_surface,
            "claim_url": evidence.claim_url,
        }
        for evidence in evidence_rows
    ]
    return (
        f"candidate_name:\n{candidate.name}\n\n"
        f"suggested_type:\n{candidate.suggested_type}\n\n"
        f"occurrence_count:\n{candidate.occurrence_count}\n\n"
        f"evidence:\n{evidence_payload}\n\n"
        "Return only a JSON object with fields: confidence, explanation"
    )


def _heuristic_candidate_confidence(
    candidate: EntityCandidate, evidence_rows: list[Any]
) -> float:
    """Score candidate stability when LLM-backed disambiguation is unavailable."""

    distinct_sources = len({row.source_plugin for row in evidence_rows})
    has_identity = any(row.identity_surface and row.claim_url for row in evidence_rows)
    title_case_name = (
        len([token for token in candidate.name.split() if token[:1].isupper()]) >= 2
    )
    score = 0.2
    score += min(candidate.occurrence_count, 8) * 0.05
    score += min(distinct_sources, 3) * 0.15
    if has_identity:
        score += 0.25
    if title_case_name:
        score += 0.1
    return min(score, 0.95)


def _best_existing_entity_match(
    candidate: EntityCandidate, entities: list[Entity]
) -> tuple[Entity | None, float]:
    """Find the closest existing entity match for a pending candidate."""

    if not entities:
        return None, 0.0
    try:
        candidate_vector = embed_text(_candidate_embedding_text(candidate))
    except Exception:
        logger.exception(
            "Failed to embed entity candidate id=%s for entity matching",
            _require_pk(candidate),
        )
        return None, 0.0

    best_entity: Entity | None = None
    best_similarity = 0.0
    for entity in entities:
        try:
            entity_vector = embed_text(build_entity_embedding_text(entity))
        except Exception:
            logger.exception(
                "Failed to embed entity id=%s while matching entity candidate id=%s",
                _require_pk(entity),
                _require_pk(candidate),
            )
            continue
        similarity = _cosine_similarity(candidate_vector, entity_vector)
        if similarity > best_similarity:
            best_similarity = similarity
            best_entity = entity
    return best_entity, best_similarity


def _exact_matching_entity(
    candidate: EntityCandidate, entities: list[Entity]
) -> Entity | None:
    """Return a case-insensitive exact-name match for the pending candidate."""

    normalized_candidate = _normalize_name(candidate.name)
    for entity in entities:
        if _normalize_name(entity.name) == normalized_candidate:
            return entity
    return None


def _entity_field_value_from_claim(claim: EntityIdentityClaim) -> tuple[str, str]:
    """Map a verified identity claim to the corresponding entity field value."""

    if claim.surface == IdentitySurface.GITHUB:
        return "github_url", claim.claim_url.rstrip("/")
    if claim.surface == IdentitySurface.LINKEDIN:
        return "linkedin_url", normalize_linkedin_url(claim.claim_url)
    if claim.surface == IdentitySurface.WEBSITE:
        return "website_url", claim.claim_url.rstrip("/")
    if claim.surface == IdentitySurface.BLUESKY:
        handle = _bluesky_handle_from_claim(claim.claim_url)
        return "bluesky_handle", handle
    if claim.surface == IdentitySurface.MASTODON:
        handle = _mastodon_handle_from_claim(claim.claim_url)
        return "mastodon_handle", handle
    return "", ""


def _claim_conflicts(entity: Entity, field_name: str, field_value: str) -> bool:
    """Return whether another entity in the project already owns the same claim."""

    for other_entity in Entity.objects.filter(project=entity.project).exclude(
        pk=entity.pk
    ):
        other_value = getattr(other_entity, field_name)
        if _normalized_field_value(field_name, other_value) == _normalized_field_value(
            field_name, field_value
        ):
            return True
    return False


def _normalized_field_value(field_name: str, value: str) -> str:
    """Normalize entity identity fields for conflict detection."""

    if field_name == "linkedin_url":
        return normalize_linkedin_url(value)
    if field_name == "bluesky_handle":
        return normalize_bluesky_handle(value)
    if field_name == "mastodon_handle":
        return normalize_mastodon_handle(value)
    return value.strip().rstrip("/").casefold()


def _bluesky_handle_from_claim(claim_url: str) -> str:
    """Extract a Bluesky handle from a canonical claim URL."""

    path_parts = [part for part in urlsplit(claim_url).path.split("/") if part]
    if len(path_parts) >= 2 and path_parts[0] == "profile":
        return normalize_bluesky_handle(path_parts[1])
    return ""


def _mastodon_handle_from_claim(claim_url: str) -> str:
    """Extract a Mastodon handle from a canonical profile URL."""

    parsed_url = urlsplit(claim_url)
    host = parsed_url.netloc.lower()
    path_parts = [part for part in parsed_url.path.split("/") if part]
    if not host or not path_parts:
        return ""
    username = path_parts[-1].removeprefix("@")
    return normalize_mastodon_handle(f"{username}@{host}")


def _clamp_unit_interval(value: object) -> float:
    """Clamp arbitrary values into the closed unit interval."""

    if isinstance(value, bool):
        numeric_value = 1.0 if value else 0.0
    elif isinstance(value, (int, float, str)):
        try:
            numeric_value = float(value)
        except ValueError:
            numeric_value = 0.0
    else:
        numeric_value = 0.0
    return max(0.0, min(1.0, numeric_value))
