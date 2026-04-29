"""Content-classification, relevance, and summarization workflow helpers.

This module contains the runtime implementation of the app's AI pipeline. It owns
the LangGraph orchestration, the heuristics and LLM fallbacks for each skill, and
the persistence of skill results and manual-review queue items.
"""

from __future__ import annotations

import logging
import re
from datetime import timedelta
from functools import lru_cache
from typing import Any, Literal, TypedDict

from django.conf import settings
from django.db.models import F
from django.utils import timezone
from langgraph.graph import END, StateGraph

from core.deduplication import canonicalize_url
from core.embeddings import (
    build_content_embedding_text,
    embed_text,
    get_reference_similarity,
    get_topic_centroid_similarity,
    search_similar_content,
)
from core.entity_extraction import run_entity_extraction
from core.llm import build_skill_user_prompt, get_skill_definition, openrouter_chat_json
from core.models import Content, ReviewQueue, ReviewReason, SkillResult, SkillStatus

logger = logging.getLogger(__name__)

DEDUPLICATION_SKILL_NAME = "deduplication"
CLASSIFICATION_SKILL_NAME = "content_classification"
ENTITY_EXTRACTION_SKILL_NAME = "entity_extraction"
RELEVANCE_SKILL_NAME = "relevance_scoring"
SUMMARIZATION_SKILL_NAME = "summarization"
RELATED_CONTENT_SKILL_NAME = "find_related"
ASYNC_AD_HOC_SKILL_NAMES = frozenset({RELEVANCE_SKILL_NAME, SUMMARIZATION_SKILL_NAME})

DEDUPLICATION_EXACT_CONFIDENCE = 1.0
DEDUPLICATION_SEMANTIC_THRESHOLD = 0.92
DEDUPLICATION_LLM_THRESHOLD = 0.88
DEDUPLICATION_LOOKBACK_DAYS = 14
AUTHORITY_RELEVANCE_MULTIPLIER = 0.3

AUTHORITY_PRIORITY_ROLES = {"author", "subject"}

CONTENT_TYPES = (
    "technical_article",
    "tutorial",
    "opinion",
    "product_announcement",
    "event",
    "release_notes",
    "other",
)


class PipelineState(TypedDict, total=False):
    """State payload passed between LangGraph pipeline nodes."""

    content_id: int
    project_id: int
    dedup: dict[str, Any] | None
    classification: dict[str, Any] | None
    entity_extraction: dict[str, Any] | None
    relevance: dict[str, Any] | None
    summary: dict[str, Any] | None
    status: str


@lru_cache(maxsize=1)
def get_ingestion_graph():
    """Build and cache the LangGraph workflow used for content processing.

    Returns:
        A compiled state graph that classifies content, scores relevance, and then
        routes the item to summarization, archival, or human review.
    """

    graph = StateGraph(PipelineState)
    graph.add_node("deduplicate", deduplicate_node)
    graph.add_node("classify", classify_node)
    graph.add_node("extract_entities", extract_entities_node)
    graph.add_node("score_relevance", relevance_node)
    graph.add_node("summarize", summarize_node)
    graph.add_node("archive", archive_node)
    graph.add_node("queue_review", queue_review_node)
    graph.set_entry_point("deduplicate")
    graph.add_conditional_edges(
        "deduplicate",
        route_after_dedup,
        {
            "duplicate": END,
            "unique": "classify",
        },
    )
    graph.add_edge("classify", "extract_entities")
    graph.add_edge("extract_entities", "score_relevance")
    graph.add_conditional_edges(
        "score_relevance",
        route_by_relevance,
        {
            "relevant": "summarize",
            "borderline": "queue_review",
            "irrelevant": "archive",
        },
    )
    graph.add_edge("summarize", END)
    graph.add_edge("archive", END)
    graph.add_edge("queue_review", END)
    return graph.compile()


def process_content_pipeline(content_id: int) -> PipelineState:
    """Run the end-to-end ingestion pipeline for one content item.

    Args:
        content_id: Primary key of the content row to process.

    Returns:
        The final pipeline state returned by the compiled LangGraph workflow.
    """

    content = Content.objects.select_related("project").get(pk=content_id)
    initial_state: PipelineState = {
        "content_id": content.id,
        "project_id": content.project_id,
        "status": "processing",
    }
    return get_ingestion_graph().invoke(initial_state)


def deduplicate_node(state: PipelineState) -> PipelineState:
    """Detect duplicates before downstream skills consume the content."""

    content = _get_content(state)
    dedup = _execute_with_retries(
        DEDUPLICATION_SKILL_NAME, lambda: run_deduplication(content)
    )

    update_fields = ["canonical_url"]
    content.canonical_url = dedup["canonical_url"]
    if dedup["is_duplicate"]:
        duplicate_target = Content.objects.get(pk=dedup["matched_content_id"])
        duplicate_target = _root_duplicate_target(duplicate_target)
        Content.objects.filter(pk=duplicate_target.pk).update(
            duplicate_signal_count=F("duplicate_signal_count") + 1
        )
        content.duplicate_of = duplicate_target
        content.is_active = False
        update_fields.extend(["duplicate_of", "is_active"])
    content.save(update_fields=update_fields)

    _create_skill_result(
        content,
        skill_name=DEDUPLICATION_SKILL_NAME,
        status=SkillStatus.COMPLETED,
        result_data=dedup,
        model_used=dedup["model_used"],
        latency_ms=dedup["latency_ms"],
        confidence=dedup["confidence"],
    )
    return {
        "dedup": dedup,
        "status": "duplicate" if dedup["is_duplicate"] else "processing",
    }


def classify_node(state: PipelineState) -> PipelineState:
    """Classify the content item and persist the resulting skill output."""

    content = _get_content(state)
    classification = _execute_with_retries(
        CLASSIFICATION_SKILL_NAME, lambda: run_content_classification(content)
    )
    content.content_type = classification["content_type"]
    content.save(update_fields=["content_type"])
    _create_skill_result(
        content,
        skill_name=CLASSIFICATION_SKILL_NAME,
        status=SkillStatus.COMPLETED,
        result_data=classification,
        model_used=classification["model_used"],
        latency_ms=classification["latency_ms"],
        confidence=classification["confidence"],
    )
    if classification["confidence"] < settings.AI_CLASSIFICATION_REVIEW_THRESHOLD:
        _upsert_review_queue_item(
            content,
            reason=ReviewReason.LOW_CONFIDENCE_CLASSIFICATION,
            confidence=float(classification["confidence"]),
        )
    return {"classification": classification}


def extract_entities_node(state: PipelineState) -> PipelineState:
    """Extract tracked-entity mentions before relevance scoring."""

    content = _get_content(state)
    extraction = _execute_with_retries(
        ENTITY_EXTRACTION_SKILL_NAME, lambda: run_entity_extraction(content)
    )
    _create_skill_result(
        content,
        skill_name=ENTITY_EXTRACTION_SKILL_NAME,
        status=SkillStatus.COMPLETED,
        result_data=extraction,
        model_used=extraction["model_used"],
        latency_ms=extraction["latency_ms"],
        confidence=extraction["confidence"],
    )
    return {"entity_extraction": extraction}


def relevance_node(state: PipelineState) -> PipelineState:
    """Score content relevance, persist the score, and keep the item active."""

    content = _get_content(state)
    relevance = _execute_with_retries(
        RELEVANCE_SKILL_NAME, lambda: run_relevance_scoring(content)
    )
    relevance, effective_relevance_score = _apply_authority_adjustment(
        content, relevance
    )
    content.relevance_score = relevance["relevance_score"]
    content.is_active = True
    content.save(
        update_fields=["relevance_score", "authority_adjusted_score", "is_active"]
    )
    _create_skill_result(
        content,
        skill_name=RELEVANCE_SKILL_NAME,
        status=SkillStatus.COMPLETED,
        result_data=relevance,
        model_used=relevance["model_used"],
        latency_ms=relevance["latency_ms"],
        confidence=effective_relevance_score,
    )
    return {"relevance": relevance}


def summarize_node(state: PipelineState) -> PipelineState:
    """Generate and store a newsletter-ready summary for relevant content."""

    content = _get_content(state)
    summary = _execute_with_retries(
        SUMMARIZATION_SKILL_NAME, lambda: run_summarization(content)
    )
    _create_skill_result(
        content,
        skill_name=SUMMARIZATION_SKILL_NAME,
        status=SkillStatus.COMPLETED,
        result_data=summary,
        model_used=summary["model_used"],
        latency_ms=summary["latency_ms"],
    )
    return {"summary": summary, "status": "completed"}


def archive_node(state: PipelineState) -> PipelineState:
    """Mark a low-value content item inactive so it drops out of active flows."""

    content = _get_content(state)
    content.is_active = False
    content.save(update_fields=["is_active"])
    return {"status": "archived"}


def queue_review_node(state: PipelineState) -> PipelineState:
    """Create or refresh a manual review item for borderline relevance."""

    content = _get_content(state)
    relevance = state.get("relevance") or {}
    _upsert_review_queue_item(
        content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        confidence=float(
            relevance.get("relevance_score", settings.AI_RELEVANCE_REVIEW_THRESHOLD)
        ),
    )
    content.is_active = True
    content.save(update_fields=["is_active"])
    return {"status": "review"}


def route_by_relevance(
    state: PipelineState,
) -> Literal["relevant", "borderline", "irrelevant"]:
    """Choose the next workflow branch from the computed relevance score.

    Args:
        state: Current pipeline state, including the relevance result when present.

    Returns:
        The route name consumed by LangGraph to continue processing.
    """

    relevance = state.get("relevance") or {}
    score = float(
        relevance.get(
            "final_relevance_score",
            relevance.get(
                "authority_adjusted_score", relevance.get("relevance_score", 0.0)
            ),
        )
    )
    if score >= settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD:
        return "relevant"
    if score < settings.AI_RELEVANCE_REVIEW_THRESHOLD:
        return "irrelevant"
    return "borderline"


def route_after_dedup(state: PipelineState) -> Literal["duplicate", "unique"]:
    """Choose whether deduplication should short-circuit the pipeline."""

    dedup = state.get("dedup") or {}
    return "duplicate" if dedup.get("is_duplicate", False) else "unique"


def run_deduplication(content: Content) -> dict[str, Any]:
    """Detect whether the content row duplicates an existing project item."""

    canonical_url = canonicalize_url(content.url)
    exact_duplicate = _find_exact_duplicate(content, canonical_url)
    if exact_duplicate is not None:
        return {
            "is_duplicate": True,
            "canonical_url": canonical_url,
            "matched_content_id": exact_duplicate.id,
            "matched_stage": "exact",
            "similarity_score": None,
            "used_llm": False,
            "explanation": "Canonical URL matched an existing content row.",
            "confidence": DEDUPLICATION_EXACT_CONFIDENCE,
            "model_used": "deterministic",
            "latency_ms": 0,
        }

    recent_candidates = {
        candidate.id: _root_duplicate_target(candidate)
        for candidate in Content.objects.filter(
            project_id=content.project_id,
            is_reference=False,
            is_active=True,
            published_date__gte=timezone.now()
            - timedelta(days=DEDUPLICATION_LOOKBACK_DAYS),
        )
        .exclude(pk=content.pk)
        .select_related("duplicate_of")
    }
    if not recent_candidates:
        return {
            "is_duplicate": False,
            "canonical_url": canonical_url,
            "matched_content_id": None,
            "matched_stage": "none",
            "similarity_score": None,
            "used_llm": False,
            "explanation": "No recent active content was available for semantic deduplication.",
            "confidence": 0.0,
            "model_used": "deterministic",
            "latency_ms": 0,
        }

    best_similarity = 0.0
    for match in search_similar_content(content, limit=8, is_reference=False):
        match_id = _coerce_content_id(getattr(match, "payload", {}).get("content_id"))
        if match_id is None or match_id not in recent_candidates:
            continue

        similarity = float(getattr(match, "score", 0.0))
        best_similarity = max(best_similarity, similarity)
        duplicate_target = recent_candidates[match_id]
        if similarity >= DEDUPLICATION_SEMANTIC_THRESHOLD:
            return {
                "is_duplicate": True,
                "canonical_url": canonical_url,
                "matched_content_id": duplicate_target.id,
                "matched_stage": "semantic",
                "similarity_score": similarity,
                "used_llm": False,
                "explanation": f"Semantic similarity of {similarity:.2f} cleared the duplicate threshold.",
                "confidence": similarity,
                "model_used": f"embedding:{settings.EMBEDDING_MODEL}",
                "latency_ms": 0,
            }

        if similarity < DEDUPLICATION_LLM_THRESHOLD:
            continue
        if _normalize_title(content.title) == _normalize_title(duplicate_target.title):
            continue

        llm_decision = _run_deduplication_tiebreak(
            content, duplicate_target, canonical_url, similarity
        )
        if llm_decision["is_duplicate"]:
            return {
                "is_duplicate": True,
                "canonical_url": canonical_url,
                "matched_content_id": duplicate_target.id,
                "matched_stage": "llm",
                "similarity_score": similarity,
                "used_llm": True,
                "explanation": llm_decision["explanation"],
                "confidence": llm_decision["confidence"],
                "model_used": llm_decision["model_used"],
                "latency_ms": llm_decision["latency_ms"],
            }

    return {
        "is_duplicate": False,
        "canonical_url": canonical_url,
        "matched_content_id": None,
        "matched_stage": "semantic",
        "similarity_score": best_similarity or None,
        "used_llm": False,
        "explanation": "No duplicate candidate cleared the canonical, semantic, or LLM duplicate checks.",
        "confidence": best_similarity,
        "model_used": f"embedding:{settings.EMBEDDING_MODEL}",
        "latency_ms": 0,
    }


def run_content_classification(content: Content) -> dict[str, Any]:
    """Classify a content item into a newsletter-oriented content type.

    Args:
        content: The content row being classified.

    Returns:
        A normalized payload containing the selected content type, confidence,
        explanation, and model metadata.
    """

    if settings.OPENROUTER_API_KEY:
        try:
            response = openrouter_chat_json(
                model=settings.AI_CLASSIFICATION_MODEL,
                system_prompt=get_skill_definition(
                    CLASSIFICATION_SKILL_NAME
                ).instructions_markdown,
                user_prompt=build_skill_user_prompt(
                    CLASSIFICATION_SKILL_NAME,
                    {
                        "title": content.title,
                        "content_text": content.content_text[:5000],
                        "url": content.url,
                    },
                ),
            )
            payload = response.payload
            content_type = str(payload.get("content_type", "other"))
            if content_type not in CONTENT_TYPES:
                content_type = "other"
            confidence = _clamp_score(payload.get("confidence", 0.5))
            return {
                "content_type": content_type,
                "confidence": confidence,
                "explanation": str(
                    payload.get("explanation", "LLM-based classification.")
                ),
                "model_used": response.model,
                "latency_ms": response.latency_ms,
            }
        except Exception:
            logger.exception(
                "Classification model call failed; falling back to heuristic classifier",
                extra={"content_id": content.id},
            )
    return _heuristic_classification(content)


def _find_exact_duplicate(content: Content, canonical_url: str) -> Content | None:
    """Find a duplicate row by canonical URL, backfilling blank values as needed."""

    exact_match = (
        Content.objects.filter(
            project_id=content.project_id, canonical_url=canonical_url
        )
        .exclude(pk=content.pk)
        .select_related("duplicate_of")
        .order_by("ingested_at", "id")
        .first()
    )
    if exact_match is not None:
        return _root_duplicate_target(exact_match)

    for candidate in (
        Content.objects.filter(project_id=content.project_id, canonical_url="")
        .exclude(pk=content.pk)
        .select_related("duplicate_of")
        .order_by("ingested_at", "id")
    ):
        candidate_canonical_url = canonicalize_url(candidate.url)
        if candidate.canonical_url != candidate_canonical_url:
            candidate.canonical_url = candidate_canonical_url
            candidate.save(update_fields=["canonical_url"])
        if candidate_canonical_url == canonical_url:
            return _root_duplicate_target(candidate)
    return None


def _root_duplicate_target(content: Content) -> Content:
    """Resolve a duplicate chain to its retained canonical content row."""

    current = content
    while current.duplicate_of_id:
        duplicate_of = current.duplicate_of
        if duplicate_of is None:
            break
        current = duplicate_of
    return current


def _run_deduplication_tiebreak(
    content: Content,
    candidate: Content,
    canonical_url: str,
    similarity: float,
) -> dict[str, Any]:
    """Use the deduplication skill markdown as an LLM tiebreak."""

    if not settings.OPENROUTER_API_KEY:
        return {
            "is_duplicate": False,
            "confidence": similarity,
            "explanation": "Borderline semantic match skipped LLM tiebreak because OpenRouter is not configured.",
            "model_used": f"embedding:{settings.EMBEDDING_MODEL}",
            "latency_ms": 0,
        }

    try:
        response = openrouter_chat_json(
            model=settings.AI_RELEVANCE_MODEL,
            system_prompt=get_skill_definition(
                DEDUPLICATION_SKILL_NAME
            ).instructions_markdown,
            user_prompt=build_skill_user_prompt(
                DEDUPLICATION_SKILL_NAME,
                {
                    "title": content.title,
                    "content_text": content.content_text[:4000],
                    "canonical_url": canonical_url,
                    "candidate_title": candidate.title,
                    "candidate_content_text": candidate.content_text[:4000],
                    "candidate_canonical_url": candidate.canonical_url
                    or canonicalize_url(candidate.url),
                    "similarity_score": f"{similarity:.3f}",
                },
            ),
        )
    except Exception:
        logger.exception(
            "Deduplication tiebreak model call failed; treating the borderline pair as distinct",
            extra={"content_id": content.id, "candidate_content_id": candidate.id},
        )
        return {
            "is_duplicate": False,
            "confidence": similarity,
            "explanation": "Borderline semantic match remained distinct after the LLM tiebreak failed.",
            "model_used": f"embedding:{settings.EMBEDDING_MODEL}",
            "latency_ms": 0,
        }

    payload = response.payload
    return {
        "is_duplicate": bool(payload.get("is_duplicate", False)),
        "confidence": _clamp_score(payload.get("confidence", similarity)),
        "explanation": str(
            payload.get(
                "explanation", "LLM deduplication tiebreak compared the candidate pair."
            )
        ),
        "model_used": response.model,
        "latency_ms": response.latency_ms,
    }


def _coerce_content_id(value: Any) -> int | None:
    """Convert a vector-search payload content ID into an integer when possible."""

    if isinstance(value, int):
        return value
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_title(value: str) -> str:
    """Normalize titles for lightweight duplicate comparisons."""

    return " ".join(value.lower().split())


def run_relevance_scoring(content: Content) -> dict[str, Any]:
    """Score how relevant a content item is to its project's topic.

    The function first measures similarity to the project's reference corpus in
    Qdrant. Only borderline scores are sent to the LLM for adjudication.

    Args:
        content: The content row being scored.

    Returns:
        A payload containing the relevance score, explanation, and model metadata.
    """

    vector = embed_text(build_content_embedding_text(content))
    reference_similarity = float(get_reference_similarity(content.project_id, vector))
    centroid_similarity = float(
        get_topic_centroid_similarity(content.project_id, vector)
    )
    similarity = max(reference_similarity, centroid_similarity)
    if (
        similarity >= settings.AI_RELEVANCE_HIGH_THRESHOLD
        or similarity < settings.AI_RELEVANCE_LOW_THRESHOLD
    ):
        explanation = f"Reference corpus similarity score is {similarity:.2f}; no LLM adjudication was required."
        if centroid_similarity > reference_similarity:
            explanation = f"Feedback centroid similarity score is {centroid_similarity:.2f}; no LLM adjudication was required."
        return {
            "relevance_score": similarity,
            "explanation": explanation,
            "used_llm": False,
            "model_used": f"embedding:{settings.EMBEDDING_MODEL}",
            "latency_ms": 0,
        }

    if settings.OPENROUTER_API_KEY:
        try:
            response = openrouter_chat_json(
                model=settings.AI_RELEVANCE_MODEL,
                system_prompt=get_skill_definition(
                    RELEVANCE_SKILL_NAME
                ).instructions_markdown,
                user_prompt=build_skill_user_prompt(
                    RELEVANCE_SKILL_NAME,
                    {
                        "newsletter_topic": content.project.topic_description,
                        "reference_similarity": f"{reference_similarity:.3f}",
                        "centroid_similarity": f"{centroid_similarity:.3f}",
                        "embedding_baseline_similarity": f"{similarity:.3f}",
                        "title": content.title,
                        "content_text": content.content_text[:5000],
                        "url": content.url,
                        "source_plugin": content.source_plugin,
                    },
                ),
            )
            payload = response.payload
            return {
                "relevance_score": _clamp_score(
                    payload.get("relevance_score", similarity)
                ),
                "explanation": str(
                    payload.get("explanation", "LLM-based relevance adjudication.")
                ),
                "used_llm": True,
                "model_used": response.model,
                "latency_ms": response.latency_ms,
            }
        except Exception:
            logger.exception(
                "Relevance model call failed; falling back to heuristic relevance",
                extra={"content_id": content.id},
            )

    return {
        "relevance_score": similarity,
        "explanation": (
            f"Borderline embedding similarity of {similarity:.2f} against the project baseline for "
            f"'{content.project.topic_description}'."
        ),
        "used_llm": False,
        "model_used": f"embedding:{settings.EMBEDDING_MODEL}",
        "latency_ms": 0,
    }


def run_summarization(content: Content) -> dict[str, Any]:
    """Generate a concise newsletter summary for a content item.

    Args:
        content: The content row to summarize.

    Returns:
        A payload containing the summary text plus model metadata.
    """

    if settings.OPENROUTER_API_KEY:
        try:
            response = openrouter_chat_json(
                model=settings.AI_SUMMARIZATION_MODEL,
                system_prompt=get_skill_definition(
                    SUMMARIZATION_SKILL_NAME
                ).instructions_markdown,
                user_prompt=build_skill_user_prompt(
                    SUMMARIZATION_SKILL_NAME,
                    {
                        "newsletter_topic": content.project.topic_description,
                        "title": content.title,
                        "content_text": content.content_text[:5000],
                        "url": content.url,
                    },
                ),
            )
            return {
                "summary": _normalize_summary(
                    str(response.payload.get("summary", "")), content
                ),
                "model_used": response.model,
                "latency_ms": response.latency_ms,
            }
        except Exception:
            logger.exception(
                "Summarization model call failed; falling back to heuristic summary",
                extra={"content_id": content.id},
            )
    return {
        "summary": _heuristic_summary(content),
        "model_used": "heuristic",
        "latency_ms": 0,
    }


def execute_ad_hoc_skill(content: Content, skill_name: str) -> SkillResult:
    """Run one supported skill immediately for a single content item.

    Args:
        content: The content row to evaluate.
        skill_name: Name of the skill to execute.

    Returns:
        The persisted skill-result row for the ad hoc execution.

    Raises:
        ValueError: If the requested skill name is not supported.
    """

    if skill_name == CLASSIFICATION_SKILL_NAME:
        return _execute_ad_hoc_classification(content)
    if skill_name == RELEVANCE_SKILL_NAME:
        return _execute_ad_hoc_relevance(content)
    if skill_name == SUMMARIZATION_SKILL_NAME:
        return _execute_ad_hoc_summarization(content)
    if skill_name == RELATED_CONTENT_SKILL_NAME:
        return _execute_ad_hoc_related_content(content)
    raise ValueError(f"Unsupported skill name: {skill_name}")


def create_pending_skill_result(content: Content, skill_name: str) -> SkillResult:
    """Create a placeholder skill-result row for async ad hoc execution.

    Args:
        content: The content row the skill will operate on.
        skill_name: Supported async skill name.

    Returns:
        A pending skill-result row that can be updated by a Celery worker.

    Raises:
        ValueError: If the skill cannot be executed asynchronously.
    """

    if skill_name not in ASYNC_AD_HOC_SKILL_NAMES:
        raise ValueError(f"Unsupported async skill name: {skill_name}")
    return _create_skill_result(
        content,
        skill_name=skill_name,
        status=SkillStatus.PENDING,
    )


def execute_background_skill_result(
    skill_result_id: int, skill_name: str
) -> SkillResult:
    """Execute an async ad hoc skill and update its persisted result row.

    Args:
        skill_result_id: Primary key of the pending skill-result row.
        skill_name: Expected skill name for the row being executed.

    Returns:
        The updated skill-result row after success or failure.

    Raises:
        ValueError: If the stored skill name does not match the requested one or if
            the skill name is unsupported.
    """

    skill_result = SkillResult.objects.select_related(
        "content", "content__project"
    ).get(pk=skill_result_id)
    if skill_result.skill_name != skill_name:
        raise ValueError(
            f"Skill result {skill_result.id} is for {skill_result.skill_name}, not {skill_name}."
        )

    _update_skill_result(skill_result, status=SkillStatus.RUNNING, error_message="")

    try:
        if skill_name == RELEVANCE_SKILL_NAME:
            relevance, relevance_score = _run_ad_hoc_relevance(skill_result.content)
            return _update_skill_result(
                skill_result,
                status=SkillStatus.COMPLETED,
                result_data=relevance,
                model_used=relevance["model_used"],
                latency_ms=relevance["latency_ms"],
                confidence=relevance_score,
                error_message="",
            )
        if skill_name == SUMMARIZATION_SKILL_NAME:
            summary = _run_ad_hoc_summarization(skill_result.content)
            return _update_skill_result(
                skill_result,
                status=SkillStatus.COMPLETED,
                result_data=summary,
                model_used=summary["model_used"],
                latency_ms=summary["latency_ms"],
                error_message="",
            )
    except Exception as exc:
        return _update_skill_result(
            skill_result,
            status=SkillStatus.FAILED,
            result_data=None,
            model_used="",
            latency_ms=None,
            confidence=None,
            error_message=str(exc),
        )

    raise ValueError(f"Unsupported async skill name: {skill_name}")


def _execute_ad_hoc_classification(content: Content) -> SkillResult:
    """Run classification immediately and persist success or failure."""

    try:
        classification = _execute_with_retries(
            CLASSIFICATION_SKILL_NAME, lambda: run_content_classification(content)
        )
        content.content_type = classification["content_type"]
        content.save(update_fields=["content_type"])
        if classification["confidence"] < settings.AI_CLASSIFICATION_REVIEW_THRESHOLD:
            _upsert_review_queue_item(
                content,
                reason=ReviewReason.LOW_CONFIDENCE_CLASSIFICATION,
                confidence=float(classification["confidence"]),
            )
        return _create_skill_result(
            content,
            skill_name=CLASSIFICATION_SKILL_NAME,
            status=SkillStatus.COMPLETED,
            result_data=classification,
            model_used=classification["model_used"],
            latency_ms=classification["latency_ms"],
            confidence=classification["confidence"],
        )
    except Exception as exc:
        return _create_failed_skill_result(
            content, skill_name=CLASSIFICATION_SKILL_NAME, error_message=str(exc)
        )


def _execute_ad_hoc_relevance(content: Content) -> SkillResult:
    """Run relevance scoring immediately and persist success or failure."""

    try:
        relevance, relevance_score = _run_ad_hoc_relevance(content)
        return _create_skill_result(
            content,
            skill_name=RELEVANCE_SKILL_NAME,
            status=SkillStatus.COMPLETED,
            result_data=relevance,
            model_used=relevance["model_used"],
            latency_ms=relevance["latency_ms"],
            confidence=relevance_score,
        )
    except Exception as exc:
        return _create_failed_skill_result(
            content, skill_name=RELEVANCE_SKILL_NAME, error_message=str(exc)
        )


def _execute_ad_hoc_summarization(content: Content) -> SkillResult:
    """Run summarization immediately and persist success or failure."""

    try:
        summary = _run_ad_hoc_summarization(content)
        return _create_skill_result(
            content,
            skill_name=SUMMARIZATION_SKILL_NAME,
            status=SkillStatus.COMPLETED,
            result_data=summary,
            model_used=summary["model_used"],
            latency_ms=summary["latency_ms"],
        )
    except Exception as exc:
        return _create_failed_skill_result(
            content, skill_name=SUMMARIZATION_SKILL_NAME, error_message=str(exc)
        )


def _execute_ad_hoc_related_content(content: Content) -> SkillResult:
    """Find similar non-reference content and store the match list as a skill result."""

    try:
        matches = search_similar_content(content, limit=5, is_reference=False)
        related_items = [_serialize_related_match(match) for match in matches]
        top_score = max((item["score"] for item in related_items), default=None)
        return _create_skill_result(
            content,
            skill_name=RELATED_CONTENT_SKILL_NAME,
            status=SkillStatus.COMPLETED,
            result_data={
                "related_items": related_items,
                "limit": 5,
            },
            model_used=f"embedding:{settings.EMBEDDING_MODEL}",
            latency_ms=0,
            confidence=top_score,
        )
    except Exception as exc:
        return _create_failed_skill_result(
            content, skill_name=RELATED_CONTENT_SKILL_NAME, error_message=str(exc)
        )


def _run_ad_hoc_relevance(content: Content) -> tuple[dict[str, Any], float]:
    """Apply ad hoc relevance scoring and update the content row accordingly."""

    relevance = _execute_with_retries(
        RELEVANCE_SKILL_NAME, lambda: run_relevance_scoring(content)
    )
    relevance, relevance_score = _apply_authority_adjustment(content, relevance)
    content.relevance_score = float(relevance["relevance_score"])
    content.is_active = relevance_score >= settings.AI_RELEVANCE_REVIEW_THRESHOLD
    content.save(
        update_fields=["relevance_score", "authority_adjusted_score", "is_active"]
    )
    if (
        settings.AI_RELEVANCE_REVIEW_THRESHOLD
        <= relevance_score
        < settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD
    ):
        _upsert_review_queue_item(
            content,
            reason=ReviewReason.BORDERLINE_RELEVANCE,
            confidence=relevance_score,
        )
    return relevance, relevance_score


def _run_ad_hoc_summarization(content: Content) -> dict[str, Any]:
    """Run summarization only when the content has already cleared the score gate.

    Args:
        content: The content row to summarize.

    Returns:
        The summarization payload returned by ``run_summarization``.

    Raises:
        ValueError: If the content has not yet reached the relevance threshold
            required for summarization.
    """

    effective_relevance_score = (
        content.authority_adjusted_score or content.relevance_score or 0.0
    )
    if effective_relevance_score < settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD:
        raise ValueError(
            "Summarization requires relevance_score >= "
            f"{settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD:.2f}. Run relevance scoring first or review the content."
        )
    return _execute_with_retries(
        SUMMARIZATION_SKILL_NAME, lambda: run_summarization(content)
    )


def _apply_authority_adjustment(
    content: Content, relevance: dict[str, Any]
) -> tuple[dict[str, Any], float]:
    """Apply the authority bump while preserving the base relevance score."""

    base_relevance_score = _clamp_score(float(relevance["relevance_score"]))
    primary_entity = _get_primary_authority_entity(content)
    authority_score = _clamp_score(
        float(getattr(primary_entity, "authority_score", 0.5) or 0.5)
    )
    adjusted_relevance_score = _clamp_score(
        base_relevance_score
        * (1 + AUTHORITY_RELEVANCE_MULTIPLIER * (authority_score - 0.5))
    )
    relevance["relevance_score"] = base_relevance_score
    relevance["authority_adjusted_score"] = adjusted_relevance_score
    relevance["final_relevance_score"] = adjusted_relevance_score
    relevance["authority_entity_id"] = getattr(primary_entity, "id", None)
    relevance["authority_score"] = authority_score
    content.authority_adjusted_score = adjusted_relevance_score
    return relevance, adjusted_relevance_score


def _get_primary_authority_entity(content: Content):
    """Choose the best entity to use for authority-aware relevance bumping."""

    if content.entity_id:
        return content.entity

    mentions = list(content.entity_mentions.select_related("entity").all())
    if not mentions:
        return None

    priority_mentions = [
        mention for mention in mentions if mention.role in AUTHORITY_PRIORITY_ROLES
    ]
    if priority_mentions:
        best_mention = max(
            priority_mentions,
            key=lambda mention: (float(mention.confidence), mention.created_at),
        )
        return best_mention.entity

    best_mention = max(
        mentions,
        key=lambda mention: (float(mention.confidence), mention.created_at),
    )
    return best_mention.entity


def _execute_with_retries(skill_name: str, fn):
    """Retry a skill callable up to the configured retry budget.

    Args:
        skill_name: Name used for logging failed attempts.
        fn: Zero-argument callable that performs the skill work.

    Returns:
        The value returned by ``fn`` when one attempt succeeds.

    Raises:
        Exception: Re-raises the final exception after all retries fail.
    """

    last_exc: Exception | None = None
    for attempt in range(settings.AI_MAX_NODE_RETRIES + 1):
        try:
            return fn()
        except Exception as exc:  # pragma: no cover
            last_exc = exc
            logger.exception(
                "Skill execution failed",
                extra={"skill_name": skill_name, "attempt": attempt + 1},
            )
    assert last_exc is not None
    raise last_exc


def _serialize_related_match(match: Any) -> dict[str, Any]:
    """Convert a Qdrant match object into the API-friendly related-content shape."""

    payload = dict(getattr(match, "payload", {}) or {})
    return {
        "content_id": payload.get("content_id"),
        "title": payload.get("title"),
        "url": payload.get("url"),
        "published_date": payload.get("published_date"),
        "source_plugin": payload.get("source_plugin"),
        "score": float(getattr(match, "score", 0.0)),
    }


def _heuristic_classification(content: Content) -> dict[str, Any]:
    text = f"{content.title}\n{content.content_text}".lower()
    keyword_sets = {
        "release_notes": ("release notes", "changelog", "version", "released"),
        "tutorial": ("tutorial", "how to", "guide", "walkthrough", "step-by-step"),
        "product_announcement": (
            "announcing",
            "launch",
            "launched",
            "available now",
            "introducing",
        ),
        "event": ("conference", "summit", "meetup", "webinar", "event"),
        "opinion": ("opinion", "why i", "lessons learned", "thoughts", "editorial"),
        "technical_article": (
            "architecture",
            "engineering",
            "platform",
            "infrastructure",
            "devops",
            "kubernetes",
        ),
    }
    best_type = "other"
    best_score = 0
    for content_type, keywords in keyword_sets.items():
        score = sum(text.count(keyword) for keyword in keywords)
        if score > best_score:
            best_type = content_type
            best_score = score
    confidence = 0.45 if best_type == "other" else min(0.95, 0.55 + (best_score * 0.1))
    return {
        "content_type": best_type,
        "confidence": confidence,
        "explanation": "Keyword heuristic based on title and body text.",
        "model_used": "heuristic",
        "latency_ms": 0,
    }


def _heuristic_summary(content: Content) -> str:
    sentences = [
        segment.strip()
        for segment in re.split(r"(?<=[.!?])\s+", content.content_text.strip())
        if segment.strip()
    ]
    if not sentences:
        return f"{content.title}: no summary was available from the source content."
    summary = " ".join(sentences[:2])
    if len(summary) > 400:
        summary = summary[:397].rstrip() + "..."
    return _normalize_summary(summary, content)


def _normalize_summary(summary: str, content: Content) -> str:
    normalized = summary.strip()
    if normalized:
        return normalized
    return f"{content.title}: summary generation returned no content."


def _clamp_score(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        score = 0.0
    return max(0.0, min(1.0, score))


def _get_content(state: PipelineState) -> Content:
    return Content.objects.select_related("project").get(pk=state["content_id"])


def _upsert_review_queue_item(
    content: Content, *, reason: ReviewReason, confidence: float
) -> ReviewQueue:
    existing = ReviewQueue.objects.filter(
        content=content, reason=reason, resolved=False
    ).first()
    if existing:
        existing.confidence = confidence
        existing.save(update_fields=["confidence"])
        return existing
    return ReviewQueue.objects.create(
        project=content.project,
        content=content,
        reason=reason,
        confidence=confidence,
    )


def _create_skill_result(
    content: Content,
    *,
    skill_name: str,
    status: SkillStatus,
    result_data: dict[str, Any] | None = None,
    error_message: str = "",
    model_used: str = "",
    latency_ms: int | None = None,
    confidence: float | None = None,
) -> SkillResult:
    previous = SkillResult.objects.filter(
        content=content, skill_name=skill_name, superseded_by__isnull=True
    ).first()
    skill_result = SkillResult.objects.create(
        content=content,
        project=content.project,
        skill_name=skill_name,
        status=status,
        result_data=result_data,
        error_message=error_message,
        model_used=model_used,
        latency_ms=latency_ms,
        confidence=confidence,
    )
    if previous:
        previous.superseded_by = skill_result
        previous.save(update_fields=["superseded_by"])
    return skill_result


def _create_failed_skill_result(
    content: Content, *, skill_name: str, error_message: str
) -> SkillResult:
    return _create_skill_result(
        content,
        skill_name=skill_name,
        status=SkillStatus.FAILED,
        result_data=None,
        error_message=error_message,
    )


def _update_skill_result(
    skill_result: SkillResult,
    *,
    status: SkillStatus,
    result_data: dict[str, Any] | None = None,
    error_message: str = "",
    model_used: str = "",
    latency_ms: int | None = None,
    confidence: float | None = None,
) -> SkillResult:
    skill_result.status = status
    skill_result.result_data = result_data
    skill_result.error_message = error_message
    skill_result.model_used = model_used
    skill_result.latency_ms = latency_ms
    skill_result.confidence = confidence
    skill_result.save(
        update_fields=[
            "status",
            "result_data",
            "error_message",
            "model_used",
            "latency_ms",
            "confidence",
        ]
    )
    return skill_result
