from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
import markdown  # type: ignore[import-untyped]
from django.conf import settings

JSON_OBJECT_PATTERN = re.compile(r"\{.*\}", re.DOTALL)


@dataclass(slots=True)
class OpenRouterJSONResponse:
    payload: dict[str, Any]
    model: str
    latency_ms: int


@dataclass(slots=True)
class SkillDefinition:
    """Represents one Claude-style skill markdown document."""

    name: str
    input_fields: tuple[str, ...]
    output_fields: tuple[str, ...]
    instructions_markdown: str
    instructions_html: str


def openrouter_chat_json(
    *, model: str, system_prompt: str, user_prompt: str
) -> OpenRouterJSONResponse:
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError(
            "OPENROUTER_API_KEY must be configured for OpenRouter chat completions."
        )

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    if settings.OPENROUTER_APP_URL:
        headers["HTTP-Referer"] = settings.OPENROUTER_APP_URL
    if settings.OPENROUTER_APP_NAME:
        headers["X-OpenRouter-Title"] = settings.OPENROUTER_APP_NAME

    started_at = time.perf_counter()
    response = httpx.post(
        f"{settings.OPENROUTER_API_BASE.rstrip('/')}/chat/completions",
        headers=headers,
        json={
            "model": model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=settings.AI_REQUEST_TIMEOUT_SECONDS,
    )
    latency_ms = int((time.perf_counter() - started_at) * 1000)
    response.raise_for_status()

    message_content = response.json()["choices"][0]["message"]["content"]
    return OpenRouterJSONResponse(
        payload=_extract_json_object(message_content),
        model=model,
        latency_ms=latency_ms,
    )


@lru_cache(maxsize=16)
def get_skill_definition(skill_name: str) -> SkillDefinition:
    """Load a skill definition from the repository skill markdown directory."""

    skill_path = get_skill_resource_path(skill_name, "SKILL.md")
    raw_text = skill_path.read_text(encoding="utf-8")
    frontmatter, body = _split_frontmatter(raw_text)
    name = frontmatter.get("name", skill_name).strip() or skill_name
    input_fields = _csv_field_list(frontmatter.get("input", ""))
    output_fields = _csv_field_list(frontmatter.get("output", ""))
    instructions_markdown = body.strip()
    return SkillDefinition(
        name=name,
        input_fields=input_fields,
        output_fields=output_fields,
        instructions_markdown=instructions_markdown,
        instructions_html=markdown.markdown(instructions_markdown),
    )


def get_skill_resource_path(skill_name: str, *relative_parts: str) -> Path:
    """Return the repository path for a runtime skill resource."""

    return (
        Path(__file__).resolve().parent.parent
        / "skills"
        / skill_name
        / Path(*relative_parts)
    )


def build_skill_user_prompt(skill_name: str, inputs: dict[str, Any]) -> str:
    """Render a consistent user prompt from a skill's declared input fields."""

    skill = get_skill_definition(skill_name)
    sections = []
    for field_name in skill.input_fields:
        value = inputs.get(field_name, "")
        sections.append(f"{field_name}:\n{_stringify_skill_input(value)}")
    if skill.output_fields:
        sections.append(
            "Return only a JSON object with these fields: "
            + ", ".join(skill.output_fields)
        )
    return "\n\n".join(sections)


def _extract_json_object(message_content: str) -> dict[str, Any]:
    try:
        payload = json.loads(message_content)
    except json.JSONDecodeError:
        match = JSON_OBJECT_PATTERN.search(message_content)
        if not match:
            raise ValueError("Model response did not contain a JSON object.")
        payload = json.loads(match.group(0))
    if not isinstance(payload, dict):
        raise ValueError("Model response JSON must be an object.")
    return payload


def _split_frontmatter(raw_text: str) -> tuple[dict[str, str], str]:
    """Split a skill markdown document into simple frontmatter and body."""

    if not raw_text.startswith("---\n"):
        return {}, raw_text
    _, _, remainder = raw_text.partition("\n")
    frontmatter_block, separator, body = remainder.partition("\n---\n")
    if not separator:
        return {}, raw_text
    frontmatter: dict[str, str] = {}
    for line in frontmatter_block.splitlines():
        if not line.strip() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        frontmatter[key.strip()] = value.strip()
    return frontmatter, body


def _csv_field_list(raw_value: str) -> tuple[str, ...]:
    """Parse a comma-separated frontmatter field list."""

    return tuple(part.strip() for part in raw_value.split(",") if part.strip())


def _stringify_skill_input(value: Any) -> str:
    """Serialize skill input values into prompt-safe text."""

    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True)
    return str(value)
