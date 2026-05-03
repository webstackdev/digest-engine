"""Retry and circuit-breaker helpers for OpenRouter-backed skills."""

from __future__ import annotations

import json
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import timedelta
from functools import lru_cache
from pathlib import Path
from typing import TypeVar

from django.conf import settings
from django.utils import timezone

from core.llm import openrouter_chat_json
from pipeline.models import PipelineCircuitBreaker

RETRY_BACKOFF_DEFAULTS = (5, 30)
CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5
CIRCUIT_BREAKER_WINDOW = timedelta(minutes=5)

SKILL_MODEL_MAP = {
    "content_classification": "AI_CLASSIFICATION_MODEL",
    "entity_extraction": "AI_CLASSIFICATION_MODEL",
    "deduplication": "AI_RELEVANCE_MODEL",
    "relevance_scoring": "AI_RELEVANCE_MODEL",
    "theme_detection": "AI_SUMMARIZATION_MODEL",
    "newsletter_composition": "AI_SUMMARIZATION_MODEL",
    "original_content_ideation": "AI_SUMMARIZATION_MODEL",
    "summarization": "AI_SUMMARIZATION_MODEL",
}

PROBE_SYSTEM_PROMPT = "Return only a JSON object with the single field ok set to true."
PROBE_USER_PROMPT = "ping"

ResultT = TypeVar("ResultT")


@dataclass(frozen=True, slots=True)
class SkillRuntimeConfig:
    """Runtime retry configuration loaded from a skill manifest."""

    name: str
    max_retries: int
    backoff_seconds: tuple[int, ...]


@dataclass(slots=True)
class RetryBudget:
    """Shared retry budget consumed across one pipeline run."""

    remaining_retries: int

    def consume_retry(self) -> bool:
        """Consume one retry slot when available."""

        if self.remaining_retries <= 0:
            return False
        self.remaining_retries -= 1
        return True


class ResilientSkillError(RuntimeError):
    """Raised when retries or a circuit breaker prevent further execution."""

    def __init__(self, skill_name: str, detail: str, *, reason: str):
        super().__init__(detail)
        self.skill_name = skill_name
        self.detail = detail
        self.reason = reason


@lru_cache(maxsize=32)
def get_skill_runtime_config(skill_name: str) -> SkillRuntimeConfig:
    """Load retry settings from ``skills/<skill_name>/skill.json`` when present."""

    skill_path = (
        Path(__file__).resolve().parent.parent / "skills" / skill_name / "skill.json"
    )
    if not skill_path.exists():
        return SkillRuntimeConfig(
            name=skill_name,
            max_retries=max(0, int(settings.AI_MAX_NODE_RETRIES)),
            backoff_seconds=RETRY_BACKOFF_DEFAULTS,
        )

    raw_payload = json.loads(skill_path.read_text(encoding="utf-8"))
    max_retries = max(
        0, int(raw_payload.get("max_retries", settings.AI_MAX_NODE_RETRIES))
    )
    raw_backoff = raw_payload.get("backoff_seconds", list(RETRY_BACKOFF_DEFAULTS))
    if not isinstance(raw_backoff, list):
        raw_backoff = list(RETRY_BACKOFF_DEFAULTS)
    return SkillRuntimeConfig(
        name=str(raw_payload.get("name", skill_name) or skill_name),
        max_retries=max_retries,
        backoff_seconds=tuple(max(0, int(value)) for value in raw_backoff),
    )


def build_retry_budget(skill_names: Iterable[str]) -> RetryBudget:
    """Return a retry budget spanning the supplied pipeline skills."""

    return RetryBudget(
        remaining_retries=sum(
            get_skill_runtime_config(skill_name).max_retries
            for skill_name in skill_names
        )
    )


def execute_with_resilience(
    skill_name: str,
    fn: Callable[[], ResultT],
    *,
    retry_budget: RetryBudget | None = None,
    use_circuit_breaker: bool = False,
) -> ResultT:
    """Execute a callable with manifest-driven retries and optional circuit breaking."""

    if use_circuit_breaker:
        breaker = _get_breaker(skill_name)
        if breaker.opened_at is not None:
            raise ResilientSkillError(
                skill_name,
                f"Circuit breaker is open for {skill_name}.",
                reason="circuit_breaker_open",
            )

    config = get_skill_runtime_config(skill_name)
    last_exc: Exception | None = None
    for attempt in range(config.max_retries + 1):
        try:
            result = fn()
            if use_circuit_breaker:
                record_circuit_breaker_success(skill_name)
            return result
        except Exception as exc:
            last_exc = exc
            if use_circuit_breaker:
                record_circuit_breaker_failure(skill_name, exc)
                if _get_breaker(skill_name).opened_at is not None:
                    raise ResilientSkillError(
                        skill_name,
                        f"Circuit breaker opened for {skill_name}: {exc}",
                        reason="circuit_breaker_open",
                    ) from exc
            if attempt >= config.max_retries:
                break
            if retry_budget is not None and not retry_budget.consume_retry():
                break
            if config.backoff_seconds:
                backoff_seconds = config.backoff_seconds[
                    min(attempt, len(config.backoff_seconds) - 1)
                ]
                if backoff_seconds > 0:
                    time.sleep(backoff_seconds)

    detail = str(last_exc) if last_exc is not None else f"{skill_name} failed."
    raise ResilientSkillError(
        skill_name, detail, reason="retry_exhausted"
    ) from last_exc


def record_circuit_breaker_failure(
    skill_name: str, exc: Exception
) -> PipelineCircuitBreaker:
    """Record one failure against the persisted breaker state for a skill."""

    breaker = _get_breaker(skill_name)
    now = timezone.now()
    if (
        breaker.window_started_at is None
        or now - breaker.window_started_at > CIRCUIT_BREAKER_WINDOW
    ):
        breaker.failure_count = 1
        breaker.window_started_at = now
    else:
        breaker.failure_count += 1
    breaker.last_failure_at = now
    breaker.last_error_message = str(exc)
    if breaker.failure_count >= CIRCUIT_BREAKER_FAILURE_THRESHOLD:
        breaker.opened_at = now
    breaker.save(
        update_fields=[
            "failure_count",
            "window_started_at",
            "last_failure_at",
            "last_error_message",
            "opened_at",
        ]
    )
    return breaker


def record_circuit_breaker_success(skill_name: str) -> PipelineCircuitBreaker:
    """Reset the persisted breaker state after one successful call."""

    breaker = _get_breaker(skill_name)
    breaker.failure_count = 0
    breaker.window_started_at = None
    breaker.opened_at = None
    breaker.last_success_at = timezone.now()
    breaker.last_error_message = ""
    breaker.save(
        update_fields=[
            "failure_count",
            "window_started_at",
            "opened_at",
            "last_success_at",
            "last_error_message",
        ]
    )
    return breaker


def opened_circuit_breakers() -> list[PipelineCircuitBreaker]:
    """Return the currently opened breakers."""

    return list(
        PipelineCircuitBreaker.objects.filter(opened_at__isnull=False).order_by(
            "skill_name"
        )
    )


def probe_circuit_breaker(skill_name: str) -> bool:
    """Probe one open breaker and close it on the first successful response."""

    model_setting_name = SKILL_MODEL_MAP.get(skill_name, "AI_SUMMARIZATION_MODEL")
    openrouter_chat_json(
        model=str(getattr(settings, model_setting_name)),
        system_prompt=PROBE_SYSTEM_PROMPT,
        user_prompt=PROBE_USER_PROMPT,
    )
    record_circuit_breaker_success(skill_name)
    return True


def _get_breaker(skill_name: str) -> PipelineCircuitBreaker:
    """Return a persisted circuit breaker row for one skill."""

    breaker, _ = PipelineCircuitBreaker.objects.get_or_create(skill_name=skill_name)
    return breaker
