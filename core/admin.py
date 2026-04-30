"""Django admin configuration for the remaining core cross-cutting workflow."""

from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin

ModelAdmin = UnfoldModelAdmin


def _score_to_percent(value):
    """Normalize score-like values for display as percentages."""

    if value is None:
        return None
    numeric_value = float(value)
    if -1.0 <= numeric_value <= 1.0:
        return numeric_value * 100
    return numeric_value


def _score_color(value) -> str:
    """Return the admin display color for a score-like value."""

    percent_value = _score_to_percent(value)
    if percent_value is None:
        return "inherit"
    if percent_value >= 75:
        return "green"
    if percent_value >= 40:
        return "orange"
    return "red"


from trends.admin import TopicCentroidSnapshotAdmin  # noqa: E402,F401


class HighValueFilter(admin.SimpleListFilter):
    """Filter content down to high-value reference items."""

    title = "Content Value"
    parameter_name = "value_tier"

    def lookups(self, request, model_admin):
        """Return the custom filter options displayed in the admin sidebar."""

        return (("high_value", "🔥 High Value (Score > 80 & Reference)"),)

    def queryset(self, request, queryset):
        """Apply the high-value filter when it is selected."""

        if self.value() == "high_value":
            return queryset.filter(relevance_score__gt=80, is_reference=True)
        return queryset


class DuplicateStateFilter(admin.SimpleListFilter):
    """Filter content by duplicate retention and suppression state."""

    title = "Duplicate State"
    parameter_name = "duplicate_state"

    def lookups(self, request, model_admin):
        """Return duplicate-state options displayed in the admin sidebar."""

        return (
            ("canonical_with_duplicates", "Canonical rows with duplicate signals"),
            ("suppressed_duplicates", "Suppressed duplicate rows"),
        )

    def queryset(self, request, queryset):
        """Apply the selected duplicate-state filter."""

        if self.value() == "canonical_with_duplicates":
            return queryset.filter(duplicate_signal_count__gt=0)
        if self.value() == "suppressed_duplicates":
            return queryset.filter(duplicate_of__isnull=False)
        return queryset


from pipeline.admin import ReviewQueueAdmin, SkillResultAdmin  # noqa: E402,F401
