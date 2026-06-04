"""Shared cron parsing helpers for project-owned scheduling."""

from __future__ import annotations

from datetime import datetime
from functools import lru_cache

CronFields = tuple[set[int], set[int], set[int], set[int], set[int]]


def validate_cron_expression(cron_expression: str) -> str:
    """Return a normalized 5-part cron expression or raise ``ValueError``."""

    normalized = normalize_cron_expression(cron_expression)
    parse_cron_expression(normalized)
    return normalized


def normalize_cron_expression(cron_expression: str) -> str:
    """Collapse whitespace and require exactly five cron fields."""

    normalized = " ".join(str(cron_expression).split())
    if not normalized:
        raise ValueError("Cron expression must not be empty.")
    if len(normalized.split(" ")) != 5:
        raise ValueError("Cron expression must contain exactly five fields.")
    return normalized


def cron_matches_now(cron_expression: str, *, now: datetime) -> bool:
    """Return whether one local timestamp satisfies a 5-part cron expression."""

    minute_set, hour_set, day_set, month_set, weekday_set = parse_cron_expression(
        cron_expression
    )
    current = now
    weekday = current.isoweekday() % 7
    return (
        current.minute in minute_set
        and current.hour in hour_set
        and current.day in day_set
        and current.month in month_set
        and weekday in weekday_set
    )


@lru_cache(maxsize=256)
def parse_cron_expression(cron_expression: str) -> CronFields:
    """Parse one normalized 5-part cron expression into comparable field sets."""

    normalized = normalize_cron_expression(cron_expression)
    minute, hour, day_of_month, month_of_year, day_of_week = normalized.split(" ")
    return (
        _parse_cron_field(minute, 0, 59),
        _parse_cron_field(hour, 0, 23),
        _parse_cron_field(day_of_month, 1, 31),
        _parse_cron_field(month_of_year, 1, 12),
        _parse_cron_field(day_of_week, 0, 7, sunday_alias=True),
    )


def _parse_cron_field(
    field_expression: str,
    minimum: int,
    maximum: int,
    *,
    sunday_alias: bool = False,
) -> set[int]:
    """Expand one cron field into its allowed integer values."""

    values: set[int] = set()
    for raw_segment in field_expression.split(","):
        segment = raw_segment.strip()
        if not segment:
            raise ValueError("Cron field contains an empty segment.")
        values.update(
            _expand_cron_segment(
                segment,
                minimum,
                maximum,
                sunday_alias=sunday_alias,
            )
        )
    if not values:
        raise ValueError("Cron field must include at least one value.")
    return values


def _expand_cron_segment(
    segment: str,
    minimum: int,
    maximum: int,
    *,
    sunday_alias: bool,
) -> set[int]:
    """Expand one cron segment, including optional step syntax."""

    step = 1
    base = segment
    if "/" in segment:
        base, step_value = segment.split("/", 1)
        step = int(step_value)
        if step <= 0:
            raise ValueError("Cron step must be greater than zero.")

    if base == "*":
        start = minimum
        end = maximum
    elif "-" in base:
        start_text, end_text = base.split("-", 1)
        start = _parse_cron_value(
            start_text,
            minimum,
            maximum,
            sunday_alias=sunday_alias,
        )
        end = _parse_cron_value(
            end_text,
            minimum,
            maximum,
            sunday_alias=sunday_alias,
        )
        if start > end:
            raise ValueError("Cron range start must not exceed its end.")
    else:
        value = _parse_cron_value(
            base,
            minimum,
            maximum,
            sunday_alias=sunday_alias,
        )
        if "/" not in segment:
            return {value}
        start = value
        end = maximum

    return {
        _normalize_cron_value(value, sunday_alias=sunday_alias)
        for value in range(start, end + 1, step)
    }


def _parse_cron_value(
    raw_value: str,
    minimum: int,
    maximum: int,
    *,
    sunday_alias: bool,
) -> int:
    """Parse and range-check one cron integer value."""

    value = int(raw_value)
    if value < minimum or value > maximum:
        raise ValueError(f"Cron value {value} must be between {minimum} and {maximum}.")
    return _normalize_cron_value(value, sunday_alias=sunday_alias)


def _normalize_cron_value(value: int, *, sunday_alias: bool) -> int:
    """Map weekday alias ``7`` onto Sunday when that alias is enabled."""

    if sunday_alias and value == 7:
        return 0
    return value


__all__ = [
    "cron_matches_now",
    "normalize_cron_expression",
    "parse_cron_expression",
    "validate_cron_expression",
]
