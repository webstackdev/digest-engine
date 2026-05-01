"""Entity extraction helpers for tracked mentions and review candidates."""

from __future__ import annotations

import re
from datetime import timedelta
from typing import Any
from urllib.parse import urlsplit

from django.conf import settings
from django.db import transaction
from django.db.models import Model
from django.utils import timezone

from content.models import Content
from core.embeddings import search_similar_entities_for_content
from core.llm import build_skill_user_prompt, get_skill_definition, openrouter_chat_json
from entities.models import (
    Entity,
    EntityCandidate,
    EntityCandidateStatus,
    EntityMention,
    EntityMentionRole,
    EntityMentionSentiment,
    EntityType,
)
from pipeline.models import SkillResult, SkillStatus

ENTITY_EXTRACTION_SKILL_NAME = "entity_extraction"
ENTITY_RETRIEVAL_LIMIT = 8
ENTITY_RETRIEVAL_THRESHOLD = 0.35
RETROACTIVE_MENTION_WINDOW_DAYS = 30

PROPER_NOUN_PATTERN = re.compile(
    r"\b(?:[A-Z][a-z0-9&+.-]+|[A-Z]{2,})(?:\s+(?:[A-Z][a-z0-9&+.-]+|[A-Z]{2,})){0,3}\b"
)
COMPANY_SUFFIXES = {
    "ai",
    "corp",
    "corporation",
    "co",
    "company",
    "group",
    "inc",
    "labs",
    "systems",
    "technologies",
    "technology",
}
ORGANIZATION_SUFFIXES = {
    "association",
    "committee",
    "consortium",
    "foundation",
    "institute",
    "university",
}
NOISE_CANDIDATE_NAMES = {
    "The",
    "This",
    "That",
    "These",
    "Platform",
    "Engineering",
    "Release Notes",
}
POSITIVE_TOKENS = {"improved", "improves", "strong", "launch", "launched", "good"}
NEGATIVE_TOKENS = {"breach", "bug", "failed", "failure", "outage", "risk"}


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed entity-extraction operations."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _project_pk(content: Content) -> int:
    """Return the content row's owning project primary key."""

    return _require_pk(content.project)


def run_entity_extraction(content: Content) -> dict[str, Any]:
    """Extract tracked-entity mentions and surface unknown candidates."""

    tracked_entities = list(
        Entity.objects.filter(project_id=_project_pk(content)).order_by("name")
    )
    extraction = _run_entity_extraction_with_fallback(content, tracked_entities)
    normalized_mentions, unresolved_names = _normalize_mentions(
        extraction.get("mentions", []), tracked_entities
    )
    if not normalized_mentions and tracked_entities:
        heuristic_result = _heuristic_entity_extraction(content, tracked_entities)
        normalized_mentions, unresolved_names = _normalize_mentions(
            heuristic_result["mentions"], tracked_entities
        )
        extraction = {
            **heuristic_result,
            "model_used": extraction.get("model_used", heuristic_result["model_used"]),
            "latency_ms": extraction.get("latency_ms", heuristic_result["latency_ms"]),
        }

    normalized_candidates = _normalize_candidates(
        extraction.get("candidate_entities", []), tracked_entities
    )
    for unresolved_name in unresolved_names:
        normalized_candidates.append(
            {
                "name": unresolved_name,
                "suggested_type": _guess_candidate_type(unresolved_name),
            }
        )
    if not normalized_candidates:
        normalized_candidates = _normalize_candidates(
            _discover_candidates(content, tracked_entities), tracked_entities
        )

    is_rerun = SkillResult.objects.filter(
        content=content,
        skill_name=ENTITY_EXTRACTION_SKILL_NAME,
        status=SkillStatus.COMPLETED,
    ).exists()
    mentions = replace_entity_mentions(content, normalized_mentions)
    candidates = persist_entity_candidates(
        content, normalized_candidates, is_rerun=is_rerun
    )
    primary_entity = _select_primary_entity(mentions)
    if primary_entity is not None and content.entity is None:
        content.entity = primary_entity
        content.save(update_fields=["entity"])

    confidence = max((mention.confidence for mention in mentions), default=0.0)
    return {
        "mentions": [_serialize_mention(mention) for mention in mentions],
        "candidate_entities": [
            _serialize_candidate(candidate) for candidate in candidates
        ],
        "primary_entity_id": (
            _require_pk(primary_entity) if primary_entity is not None else None
        ),
        "confidence": confidence,
        "explanation": extraction.get(
            "explanation",
            "Entity extraction matched tracked entities and proposed new candidate names.",
        ),
        "model_used": extraction.get("model_used", "heuristic"),
        "latency_ms": int(extraction.get("latency_ms", 0) or 0),
    }


def replace_entity_mentions(
    content: Content, mention_payloads: list[dict[str, Any]]
) -> list[EntityMention]:
    """Replace the extracted mentions stored for a content item."""

    EntityMention.objects.filter(content=content).delete()
    return upsert_entity_mentions(content, mention_payloads)


def upsert_entity_mentions(
    content: Content, mention_payloads: list[dict[str, Any]]
) -> list[EntityMention]:
    """Upsert mention rows for a content item without clearing other data first."""

    mentions: list[EntityMention] = []
    seen_keys: set[tuple[int, str]] = set()
    for mention_payload in mention_payloads:
        entity = mention_payload["entity"]
        role = mention_payload["role"]
        key = (entity.id, role)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        mention, _ = EntityMention.objects.update_or_create(
            content=content,
            entity=entity,
            role=role,
            defaults={
                "project": content.project,
                "sentiment": mention_payload["sentiment"],
                "span": mention_payload["span"],
                "confidence": mention_payload["confidence"],
            },
        )
        mentions.append(mention)
    return mentions


def persist_entity_candidates(
    content: Content,
    candidate_payloads: list[dict[str, str]],
    *,
    is_rerun: bool,
) -> list[EntityCandidate]:
    """Create or update pending entity candidates discovered in content."""

    persisted: list[EntityCandidate] = []
    tracked_names = {
        _normalize_name(entity.name)
        for entity in Entity.objects.filter(project_id=_project_pk(content)).only(
            "name"
        )
    }
    seen_names: set[str] = set()
    for candidate_payload in candidate_payloads:
        raw_name = candidate_payload.get("name", "")
        name = _clean_candidate_name(raw_name)
        normalized_name = _normalize_name(name)
        if (
            not name
            or normalized_name in seen_names
            or normalized_name in tracked_names
        ):
            continue
        seen_names.add(normalized_name)
        candidate, created = EntityCandidate.objects.get_or_create(
            project=content.project,
            name=name,
            defaults={
                "suggested_type": candidate_payload.get(
                    "suggested_type", _guess_candidate_type(name)
                ),
                "first_seen_in": content,
                "occurrence_count": 1,
                "status": EntityCandidateStatus.PENDING,
            },
        )
        if not created:
            update_fields: list[str] = []
            suggested_type = candidate_payload.get(
                "suggested_type",
                candidate.suggested_type or _guess_candidate_type(name),
            )
            if candidate.suggested_type != suggested_type:
                candidate.suggested_type = suggested_type
                update_fields.append("suggested_type")
            if candidate.first_seen_in is None:
                candidate.first_seen_in = content
                update_fields.append("first_seen_in")
            if not is_rerun:
                candidate.occurrence_count += 1
                update_fields.append("occurrence_count")
            if update_fields:
                candidate.save(update_fields=update_fields + ["updated_at"])
        persisted.append(candidate)
    return persisted


@transaction.atomic
def accept_entity_candidate(candidate: EntityCandidate) -> Entity:
    """Accept a candidate, create the tracked entity, and backfill recent mentions."""

    entity, _ = Entity.objects.get_or_create(
        project=candidate.project,
        name=candidate.name,
        defaults={
            "type": candidate.suggested_type,
        },
    )
    candidate.status = EntityCandidateStatus.ACCEPTED
    candidate.merged_into = entity
    candidate.save(update_fields=["status", "merged_into", "updated_at"])
    backfill_entity_mentions(entity, candidate_name=candidate.name)
    return entity


@transaction.atomic
def merge_entity_candidate(candidate: EntityCandidate, entity: Entity) -> Entity:
    """Merge a candidate into an existing tracked entity and backfill mentions."""

    candidate.status = EntityCandidateStatus.MERGED
    candidate.merged_into = entity
    candidate.save(update_fields=["status", "merged_into", "updated_at"])
    backfill_entity_mentions(entity, candidate_name=candidate.name)
    return entity


def reject_entity_candidate(candidate: EntityCandidate) -> None:
    """Reject an extracted candidate without creating a tracked entity."""

    candidate.status = EntityCandidateStatus.REJECTED
    candidate.save(update_fields=["status", "updated_at"])


def backfill_entity_mentions(
    entity: Entity, *, candidate_name: str | None = None
) -> None:
    """Retroactively attach recent content rows to an accepted or merged entity."""

    cutoff = timezone.now() - timedelta(days=RETROACTIVE_MENTION_WINDOW_DAYS)
    recent_content = Content.objects.filter(
        project=entity.project,
        published_date__gte=cutoff,
    ).order_by("-published_date")
    labels = _entity_labels(entity)
    if candidate_name:
        labels.append(candidate_name)
    labels = [label for label in labels if label]
    for content in recent_content:
        mention_payloads = _heuristic_mentions_for_entities(
            content,
            [entity],
            extra_labels={_require_pk(entity): labels},
        )
        mentions = upsert_entity_mentions(content, mention_payloads)
        if content.entity is None and any(
            mention.role in {EntityMentionRole.SUBJECT, EntityMentionRole.AUTHOR}
            for mention in mentions
        ):
            content.entity = entity
            content.save(update_fields=["entity"])


def _run_entity_extraction_with_fallback(
    content: Content, tracked_entities: list[Entity]
) -> dict[str, Any]:
    """Run the LLM extraction step when configured, else use heuristics."""

    if not settings.OPENROUTER_API_KEY:
        return _heuristic_entity_extraction(content, tracked_entities)

    candidate_entities = _retrieve_candidate_entities(content, tracked_entities)
    try:
        response = openrouter_chat_json(
            model=settings.AI_CLASSIFICATION_MODEL,
            system_prompt=get_skill_definition(
                ENTITY_EXTRACTION_SKILL_NAME
            ).instructions_markdown,
            user_prompt=build_skill_user_prompt(
                ENTITY_EXTRACTION_SKILL_NAME,
                {
                    "title": content.title,
                    "content_text": content.content_text[:5000],
                    "project_id": _project_pk(content),
                    "tracked_entities": [
                        _serialize_tracked_entity(entity)
                        for entity in candidate_entities
                    ],
                },
            ),
        )
    except Exception:
        return _heuristic_entity_extraction(content, tracked_entities)

    payload = response.payload
    return {
        "mentions": payload.get("mentions", []),
        "candidate_entities": payload.get("candidate_entities", []),
        "explanation": str(
            payload.get(
                "explanation",
                "LLM verified which tracked entities were present in the content.",
            )
        ),
        "model_used": response.model,
        "latency_ms": response.latency_ms,
    }


def _heuristic_entity_extraction(
    content: Content, tracked_entities: list[Entity]
) -> dict[str, Any]:
    """Fallback extractor that relies on exact label matches and title heuristics."""

    candidate_entities = _retrieve_candidate_entities(content, tracked_entities)
    mention_payloads = _heuristic_mentions_for_entities(content, candidate_entities)
    return {
        "mentions": [
            {
                "entity_name": mention_payload["entity"].name,
                "span": mention_payload["span"],
                "sentiment": mention_payload["sentiment"],
                "role": mention_payload["role"],
                "confidence": mention_payload["confidence"],
            }
            for mention_payload in mention_payloads
        ],
        "candidate_entities": _discover_candidates(content, tracked_entities),
        "explanation": "Heuristic extraction matched exact entity labels in the title, author, or body.",
        "model_used": "heuristic",
        "latency_ms": 0,
    }


def _retrieve_candidate_entities(
    content: Content, tracked_entities: list[Entity]
) -> list[Entity]:
    """Retrieve likely tracked entities using Qdrant plus exact label matches."""

    if not tracked_entities:
        return []

    entities_by_id = {_require_pk(entity): entity for entity in tracked_entities}
    ordered_ids: list[int] = []
    try:
        matches = search_similar_entities_for_content(
            content, limit=ENTITY_RETRIEVAL_LIMIT
        )
    except Exception:
        matches = []

    for match in matches:
        if float(getattr(match, "score", 0.0)) < ENTITY_RETRIEVAL_THRESHOLD:
            continue
        entity_id = getattr(match, "payload", {}).get("entity_id")
        if isinstance(entity_id, int) and entity_id in entities_by_id:
            ordered_ids.append(entity_id)

    exact_match_ids = {
        _require_pk(entity)
        for entity in tracked_entities
        if _find_entity_span(content, entity, extra_labels=None) is not None
    }
    for entity_id in sorted(exact_match_ids):
        if entity_id not in ordered_ids:
            ordered_ids.append(entity_id)
    if not ordered_ids:
        return tracked_entities
    return [
        entities_by_id[entity_id]
        for entity_id in ordered_ids
        if entity_id in entities_by_id
    ]


def _normalize_mentions(
    raw_mentions: Any, tracked_entities: list[Entity]
) -> tuple[list[dict[str, Any]], list[str]]:
    """Resolve extracted mentions to tracked entities and collect unknown names."""

    entity_lookup = _entity_lookup(tracked_entities)
    normalized_mentions: list[dict[str, Any]] = []
    unresolved_names: list[str] = []
    if not isinstance(raw_mentions, list):
        return normalized_mentions, unresolved_names

    for raw_mention in raw_mentions:
        if not isinstance(raw_mention, dict):
            continue
        entity_name = _clean_candidate_name(str(raw_mention.get("entity_name", "")))
        if not entity_name:
            continue
        entity = entity_lookup.get(_normalize_name(entity_name))
        if entity is None:
            unresolved_names.append(entity_name)
            continue
        normalized_mentions.append(
            {
                "entity": entity,
                "role": _normalize_role(raw_mention.get("role")),
                "sentiment": _normalize_sentiment(raw_mention.get("sentiment")),
                "span": str(raw_mention.get("span", entity_name)).strip(),
                "confidence": _normalize_confidence(
                    raw_mention.get("confidence", 0.75)
                ),
            }
        )
    return normalized_mentions, unresolved_names


def _normalize_candidates(
    raw_candidates: Any, tracked_entities: list[Entity]
) -> list[dict[str, str]]:
    """Normalize candidate payloads returned by the extractor."""

    tracked_names = {_normalize_name(entity.name) for entity in tracked_entities}
    normalized_candidates: list[dict[str, str]] = []
    seen_names: set[str] = set()
    if not isinstance(raw_candidates, list):
        return normalized_candidates

    for raw_candidate in raw_candidates:
        if isinstance(raw_candidate, str):
            candidate_name = _clean_candidate_name(raw_candidate)
            suggested_type = _guess_candidate_type(candidate_name)
        elif isinstance(raw_candidate, dict):
            candidate_name = _clean_candidate_name(str(raw_candidate.get("name", "")))
            suggested_type = str(
                raw_candidate.get(
                    "suggested_type", _guess_candidate_type(candidate_name)
                )
            )
        else:
            continue
        normalized_name = _normalize_name(candidate_name)
        if (
            not candidate_name
            or normalized_name in tracked_names
            or normalized_name in seen_names
        ):
            continue
        seen_names.add(normalized_name)
        normalized_candidates.append(
            {
                "name": candidate_name,
                "suggested_type": _normalize_entity_type(suggested_type),
            }
        )
    return normalized_candidates


def _discover_candidates(
    content: Content, tracked_entities: list[Entity]
) -> list[dict[str, str]]:
    """Heuristically surface named entities that are not yet tracked."""

    tracked_labels = set(_entity_lookup(tracked_entities).keys())
    discovered: list[dict[str, str]] = []
    seen_names: set[str] = set()
    candidate_text = "\n".join(
        part
        for part in [content.author, content.title, content.content_text[:2000]]
        if part
    )
    for match in PROPER_NOUN_PATTERN.findall(candidate_text):
        name = _clean_candidate_name(match)
        normalized_name = _normalize_name(name)
        if (
            not name
            or name in NOISE_CANDIDATE_NAMES
            or normalized_name in tracked_labels
            or normalized_name in seen_names
        ):
            continue
        seen_names.add(normalized_name)
        discovered.append({"name": name, "suggested_type": _guess_candidate_type(name)})
    return discovered


def _heuristic_mentions_for_entities(
    content: Content,
    entities: list[Entity],
    *,
    extra_labels: dict[int, list[str]] | None = None,
) -> list[dict[str, Any]]:
    """Build mention payloads from exact label matches in the content text."""

    mention_payloads: list[dict[str, Any]] = []
    for entity in entities:
        span = _find_entity_span(content, entity, extra_labels=extra_labels)
        if span is None:
            continue
        mention_payloads.append(
            {
                "entity": entity,
                "role": _detect_role(content, span),
                "sentiment": _detect_sentiment(content, span),
                "span": span,
                "confidence": _heuristic_confidence(content, span),
            }
        )
    return mention_payloads


def _find_entity_span(
    content: Content,
    entity: Entity,
    *,
    extra_labels: dict[int, list[str]] | None,
) -> str | None:
    """Return the first matched label for an entity inside the content."""

    entity_id = _require_pk(entity)
    labels = extra_labels.get(entity_id, []) if extra_labels is not None else []
    labels = [*labels, *_entity_labels(entity)]
    haystacks = [content.author or "", content.title or "", content.content_text or ""]
    for label in labels:
        stripped_label = label.strip()
        if not stripped_label:
            continue
        pattern = re.compile(
            rf"(?<!\w){re.escape(stripped_label)}(?!\w)", re.IGNORECASE
        )
        for haystack in haystacks:
            if pattern.search(haystack):
                return stripped_label
    return None


def _entity_labels(entity: Entity) -> list[str]:
    """Return the names and handle-like aliases that can refer to an entity."""

    labels = [entity.name]
    for handle in (
        entity.bluesky_handle,
        entity.mastodon_handle,
        entity.twitter_handle,
    ):
        cleaned_handle = handle.strip().removeprefix("@")
        if cleaned_handle:
            labels.extend([cleaned_handle, f"@{cleaned_handle}"])
            labels.append(cleaned_handle.split(".")[0])
    for url in (entity.website_url, entity.github_url, entity.linkedin_url):
        hostname = urlsplit(url).netloc.lower().removeprefix("www.")
        if hostname:
            labels.append(hostname)
            labels.append(hostname.split(".")[0])
    deduped_labels: list[str] = []
    seen_labels: set[str] = set()
    for label in labels:
        normalized_label = _normalize_name(label)
        if not normalized_label or normalized_label in seen_labels:
            continue
        seen_labels.add(normalized_label)
        deduped_labels.append(label)
    return deduped_labels


def _entity_lookup(entities: list[Entity]) -> dict[str, Entity]:
    """Map normalized names and aliases to their tracked entity rows."""

    lookup: dict[str, Entity] = {}
    for entity in entities:
        for label in _entity_labels(entity):
            lookup[_normalize_name(label)] = entity
    return lookup


def _detect_role(content: Content, span: str) -> str:
    """Infer an entity mention role from where the match appeared."""

    span_lower = span.lower()
    if content.author and span_lower in content.author.lower():
        return EntityMentionRole.AUTHOR
    if content.title and span_lower in content.title.lower():
        return EntityMentionRole.SUBJECT
    if re.search(
        rf'"[^\n]{{0,120}}{re.escape(span)}[^\n]{{0,120}}"',
        content.content_text,
        re.IGNORECASE,
    ):
        return EntityMentionRole.QUOTED
    return EntityMentionRole.MENTIONED


def _detect_sentiment(content: Content, span: str) -> str:
    """Infer a coarse sentiment label from nearby context around the span."""

    text = f"{content.title}\n{content.content_text}"
    match = re.search(re.escape(span), text, re.IGNORECASE)
    if match is None:
        return EntityMentionSentiment.NEUTRAL
    start = max(0, match.start() - 80)
    end = min(len(text), match.end() + 80)
    window = text[start:end].lower()
    if any(token in window for token in NEGATIVE_TOKENS):
        return EntityMentionSentiment.NEGATIVE
    if any(token in window for token in POSITIVE_TOKENS):
        return EntityMentionSentiment.POSITIVE
    return EntityMentionSentiment.NEUTRAL


def _heuristic_confidence(content: Content, span: str) -> float:
    """Assign a confidence score for heuristic mention matches."""

    span_lower = span.lower()
    if content.author and span_lower in content.author.lower():
        return 0.9
    if content.title and span_lower in content.title.lower():
        return 0.85
    return 0.72


def _select_primary_entity(mentions: list[EntityMention]) -> Entity | None:
    """Choose the best single entity to attach directly to the content row."""

    for preferred_role in (EntityMentionRole.SUBJECT, EntityMentionRole.AUTHOR):
        for mention in mentions:
            if mention.role == preferred_role:
                return mention.entity
    return mentions[0].entity if mentions else None


def _serialize_tracked_entity(entity: Entity) -> dict[str, Any]:
    """Serialize tracked entity context for the entity-extraction skill prompt."""

    return {
        "name": entity.name,
        "type": entity.type,
        "aliases": _entity_labels(entity),
        "description": entity.description,
    }


def _serialize_mention(mention: EntityMention) -> dict[str, Any]:
    """Serialize a persisted mention for the skill result payload."""

    return {
        "entity_id": _require_pk(mention.entity),
        "entity_name": mention.entity.name,
        "role": mention.role,
        "sentiment": mention.sentiment,
        "span": mention.span,
        "confidence": mention.confidence,
    }


def _serialize_candidate(candidate: EntityCandidate) -> dict[str, Any]:
    """Serialize a persisted candidate for the skill result payload."""

    return {
        "id": _require_pk(candidate),
        "name": candidate.name,
        "suggested_type": candidate.suggested_type,
        "occurrence_count": candidate.occurrence_count,
        "status": candidate.status,
    }


def _normalize_role(value: Any) -> str:
    """Normalize free-form role strings into the supported enum values."""

    role = str(value or "").strip().lower()
    if role in EntityMentionRole.values:
        return role
    return EntityMentionRole.MENTIONED


def _normalize_sentiment(value: Any) -> str:
    """Normalize free-form sentiment strings into the supported enum values."""

    sentiment = str(value or "").strip().lower()
    if sentiment in EntityMentionSentiment.values:
        return sentiment
    return EntityMentionSentiment.NEUTRAL


def _normalize_entity_type(value: Any) -> str:
    """Normalize free-form entity-type strings into the supported enum values."""

    entity_type = str(value or "").strip().lower()
    if entity_type in EntityType.values:
        return entity_type
    return EntityType.ORGANIZATION


def _normalize_confidence(value: Any) -> float:
    """Clamp arbitrary confidence inputs into the [0, 1] range."""

    try:
        confidence = float(value)
    except (TypeError, ValueError):
        confidence = 0.0
    return max(0.0, min(1.0, confidence))


def _guess_candidate_type(name: str) -> str:
    """Infer a plausible entity type for a newly discovered candidate."""

    tokens = [token.strip(".,") for token in name.lower().split() if token]
    if any(token in COMPANY_SUFFIXES for token in tokens):
        return EntityType.VENDOR
    if any(token in ORGANIZATION_SUFFIXES for token in tokens):
        return EntityType.ORGANIZATION
    title_case_tokens = [
        token for token in name.split() if token and token[:1].isupper()
    ]
    if 2 <= len(title_case_tokens) <= 3:
        return EntityType.INDIVIDUAL
    return EntityType.ORGANIZATION


def _clean_candidate_name(value: str) -> str:
    """Normalize candidate names while preserving user-facing capitalization."""

    cleaned_value = re.sub(r"\s+", " ", value).strip(" ,.;:-")
    if not cleaned_value or len(cleaned_value) < 3:
        return ""
    return cleaned_value


def _normalize_name(value: str) -> str:
    """Case-fold and collapse whitespace for entity-name comparisons."""

    return re.sub(r"\s+", " ", value).strip().casefold()
