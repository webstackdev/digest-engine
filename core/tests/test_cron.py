from datetime import datetime

import pytest
from django.utils import timezone

from core.cron import cron_matches_now, validate_cron_expression


def test_validate_cron_expression_normalizes_ranges_lists_and_steps():
    assert validate_cron_expression(" 0,15-30/15  9 * * 1-5 ") == "0,15-30/15 9 * * 1-5"


@pytest.mark.parametrize(
    "expression",
    [
        "",
        "* * * *",
        "not a cron",
        "61 9 * * *",
        "0 24 * * *",
        "0 9 * 13 *",
        "0 9 * * 9",
        "0 9 * * */0",
    ],
)
def test_validate_cron_expression_rejects_invalid_values(expression):
    with pytest.raises(ValueError):
        validate_cron_expression(expression)


def test_cron_matches_now_accepts_sunday_alias():
    sunday_morning = timezone.make_aware(datetime(2026, 5, 24, 9, 17, 0))

    assert cron_matches_now("17 9 * * 0", now=sunday_morning)
    assert cron_matches_now("17 9 * * 7", now=sunday_morning)
    assert not cron_matches_now("18 9 * * 7", now=sunday_morning)
