"""Admin configuration for trends-domain models."""

from typing import Any, cast
from urllib.parse import urlencode

from django.contrib import admin
from django.db.models import Avg, Max
from django.urls import reverse
from django.utils import timezone

from trends.models import SourceDiversitySnapshot, TopicCentroidSnapshot, TrendTaskRun


def _project_pk(snapshot: TopicCentroidSnapshot) -> int:
    """Return the saved project primary key for a centroid snapshot."""

    project_pk = snapshot.project.pk
    if project_pk is None:
        raise ValueError("TopicCentroidSnapshot.project must be saved first.")
    return int(project_pk)


def _score_to_percent(value):
    """Normalize score-like values for display as percentages."""

    if value is None:
        return None
    numeric_value = float(value)
    if -1.0 <= numeric_value <= 1.0:
        return numeric_value * 100
    return numeric_value


def _drift_card_color(value) -> str:
    """Return an admin card severity for centroid drift percentages."""

    if value is None:
        return "info"
    numeric_value = float(value)
    if numeric_value <= 0.15:
        return "success"
    if numeric_value <= 0.35:
        return "warning"
    return "danger"


def _diversity_card_color(value) -> str:
    """Return an admin card severity for normalized diversity scores."""

    if value is None:
        return "info"
    numeric_value = float(value)
    if numeric_value >= 0.75:
        return "success"
    if numeric_value >= 0.4:
        return "warning"
    return "danger"


def _share_card_color(value) -> str:
    """Return an admin card severity for concentration share metrics."""

    if value is None:
        return "info"
    numeric_value = float(value)
    if numeric_value <= 0.4:
        return "success"
    if numeric_value <= 0.7:
        return "warning"
    return "danger"


def _format_snapshot_freshness(computed_at) -> str:
    """Return a compact human-readable age for the latest snapshot."""

    if computed_at is None:
        return "-"
    age = timezone.now() - computed_at
    total_hours = max(0, int(age.total_seconds() // 3600))
    if total_hours < 24:
        return f"{total_hours}h ago"
    return f"{max(1, total_hours // 24)}d ago"


def _freshness_card_color(computed_at) -> str:
    """Return an admin card severity based on snapshot recency."""

    if computed_at is None:
        return "warning"
    age = timezone.now() - computed_at
    age_hours = age.total_seconds() / 3600
    if age_hours <= 24:
        return "success"
    if age_hours <= 72:
        return "warning"
    return "danger"


def _build_topic_centroid_project_drilldowns(queryset, changelist_url: str):
    """Build one filtered-history drilldown row per project."""

    latest_by_project: dict[int, TopicCentroidSnapshot] = {}
    snapshot_counts: dict[int, int] = {}
    ordered_snapshots = queryset.select_related("project").order_by(
        "project_id", "-computed_at"
    )

    for snapshot in ordered_snapshots:
        project_id = _project_pk(snapshot)
        snapshot_counts[project_id] = snapshot_counts.get(project_id, 0) + 1
        latest_by_project.setdefault(project_id, snapshot)

    project_drilldowns = []
    for snapshot in sorted(
        latest_by_project.values(),
        key=lambda value: value.project.name.lower(),
    ):
        project_id = _project_pk(snapshot)
        project_drilldowns.append(
            {
                "project_id": project_id,
                "project_name": snapshot.project.name,
                "snapshot_count": snapshot_counts[project_id],
                "centroid_active": snapshot.centroid_active,
                "feedback_count": snapshot.feedback_count,
                "latest_snapshot": _format_snapshot_freshness(snapshot.computed_at),
                "drift_from_previous": (
                    f"{_score_to_percent(snapshot.drift_from_previous):.1f}%"
                    if snapshot.drift_from_previous is not None
                    else "n/a"
                ),
                "drift_from_week_ago": (
                    f"{_score_to_percent(snapshot.drift_from_week_ago):.1f}%"
                    if snapshot.drift_from_week_ago is not None
                    else "n/a"
                ),
                "href": f"{changelist_url}?{urlencode({'project__id__exact': project_id})}",
            }
        )

    return project_drilldowns


def _build_source_diversity_project_drilldowns(queryset, changelist_url: str):
    """Build one filtered-history drilldown row per project."""

    latest_by_project: dict[int, SourceDiversitySnapshot] = {}
    snapshot_counts: dict[int, int] = {}
    ordered_snapshots = queryset.select_related("project").order_by(
        "project_id", "-computed_at"
    )

    for snapshot in ordered_snapshots:
        project_id = int(snapshot.project_id)
        snapshot_counts[project_id] = snapshot_counts.get(project_id, 0) + 1
        latest_by_project.setdefault(project_id, snapshot)

    project_drilldowns = []
    for snapshot in sorted(
        latest_by_project.values(),
        key=lambda value: value.project.name.lower(),
    ):
        project_id = int(snapshot.project_id)
        alerts = cast(
            list[dict[str, Any]], (snapshot.breakdown or {}).get("alerts", [])
        )
        project_drilldowns.append(
            {
                "project_id": project_id,
                "project_name": snapshot.project.name,
                "snapshot_count": snapshot_counts[project_id],
                "latest_snapshot": _format_snapshot_freshness(snapshot.computed_at),
                "plugin_entropy": f"{_score_to_percent(snapshot.plugin_entropy):.1f}%",
                "source_entropy": f"{_score_to_percent(snapshot.source_entropy):.1f}%",
                "top_plugin_share": f"{_score_to_percent(snapshot.top_plugin_share):.1f}%",
                "alert_count": len(alerts),
                "href": f"{changelist_url}?{urlencode({'project__id__exact': project_id})}",
            }
        )

    return project_drilldowns


@admin.register(TopicCentroidSnapshot)
class TopicCentroidSnapshotAdmin(admin.ModelAdmin):
    """Admin view for persisted topic-centroid history and drift."""

    list_before_template = "admin/topic_centroid_snapshot_changelist_widget.html"
    list_display = (
        "project",
        "centroid_active",
        "feedback_count",
        "display_drift_from_previous",
        "display_drift_from_week_ago",
        "computed_at",
    )
    list_filter = (
        "centroid_active",
        ("project", admin.RelatedOnlyFieldListFilter),
        "computed_at",
    )
    search_fields = ("project__name",)
    autocomplete_fields = ("project",)

    @admin.display(description="Drift vs Previous", ordering="drift_from_previous")
    def display_drift_from_previous(self, obj):
        """Render cosine-distance drift from the previous active snapshot."""

        if obj.drift_from_previous is None:
            return "n/a"
        return f"{_score_to_percent(obj.drift_from_previous):.1f}%"

    @admin.display(description="Drift vs 7d", ordering="drift_from_week_ago")
    def display_drift_from_week_ago(self, obj):
        """Render cosine-distance drift from the nearest week-old snapshot."""

        if obj.drift_from_week_ago is None:
            return "n/a"
        return f"{_score_to_percent(obj.drift_from_week_ago):.1f}%"

    def changelist_view(self, request, extra_context=None):
        """Augment the changelist with centroid freshness and drift summary cards."""

        queryset = self.get_queryset(request)
        changelist_url = reverse(
            f"{self.admin_site.name}:{self.model._meta.app_label}_{self.model._meta.model_name}_changelist"
        )
        metrics = queryset.aggregate(
            avg_drift_from_previous=Avg("drift_from_previous"),
            avg_drift_from_week_ago=Avg("drift_from_week_ago"),
            latest_snapshot_at=Max("computed_at"),
        )
        project_count = queryset.values("project_id").distinct().count()
        active_project_count = (
            queryset.filter(centroid_active=True)
            .values("project_id")
            .distinct()
            .count()
        )

        extra_context = cast(dict[str, Any], extra_context or {})
        extra_context["dashboard_stats"] = [
            {
                "title": "Active Centroids",
                "value": (
                    f"{active_project_count} / {project_count}"
                    if project_count
                    else "0 / 0"
                ),
                "icon": "hub",
                "color": (
                    "success"
                    if active_project_count == project_count and project_count
                    else "warning"
                ),
            },
            {
                "title": "Avg Drift vs Previous",
                "value": (
                    f"{_score_to_percent(metrics['avg_drift_from_previous']):.1f}%"
                    if metrics["avg_drift_from_previous"] is not None
                    else "-"
                ),
                "icon": "show_chart",
                "color": _drift_card_color(metrics["avg_drift_from_previous"]),
            },
            {
                "title": "Avg Drift vs 7d",
                "value": (
                    f"{_score_to_percent(metrics['avg_drift_from_week_ago']):.1f}%"
                    if metrics["avg_drift_from_week_ago"] is not None
                    else "-"
                ),
                "icon": "timeline",
                "color": _drift_card_color(metrics["avg_drift_from_week_ago"]),
            },
            {
                "title": "Latest Snapshot",
                "value": _format_snapshot_freshness(metrics["latest_snapshot_at"]),
                "icon": "schedule",
                "color": _freshness_card_color(metrics["latest_snapshot_at"]),
            },
        ]
        extra_context["centroid_project_drilldowns"] = (
            _build_topic_centroid_project_drilldowns(queryset, changelist_url)
        )
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(TrendTaskRun)
class TrendTaskRunAdmin(admin.ModelAdmin):
    """Admin view for persisted trend pipeline task executions."""

    list_display = (
        "project",
        "task_name",
        "status",
        "latency_ms",
        "started_at",
        "finished_at",
    )
    list_filter = (
        "task_name",
        "status",
        ("project", admin.RelatedOnlyFieldListFilter),
        "started_at",
    )
    search_fields = ("project__name", "task_name", "error_message")
    autocomplete_fields = ("project",)
    readonly_fields = (
        "project",
        "task_name",
        "task_run_id",
        "status",
        "started_at",
        "finished_at",
        "latency_ms",
        "error_message",
        "summary",
    )

    def has_add_permission(self, request):
        """Hide manual creation because task runs are pipeline-managed."""

        return False

    def has_change_permission(self, request, obj=None):
        """Expose task runs as read-only admin rows."""

        return False


@admin.register(SourceDiversitySnapshot)
class SourceDiversitySnapshotAdmin(admin.ModelAdmin):
    """Admin view for persisted source-diversity history and concentration alerts."""

    list_before_template = "admin/source_diversity_snapshot_changelist_widget.html"
    list_display = (
        "project",
        "display_plugin_entropy",
        "display_source_entropy",
        "display_author_entropy",
        "display_top_plugin_share",
        "computed_at",
    )
    list_filter = (
        "window_days",
        ("project", admin.RelatedOnlyFieldListFilter),
        "computed_at",
    )
    search_fields = ("project__name",)
    autocomplete_fields = ("project",)

    @admin.display(description="Plugin Diversity", ordering="plugin_entropy")
    def display_plugin_entropy(self, obj):
        """Render normalized plugin diversity as a percentage."""

        return f"{_score_to_percent(obj.plugin_entropy):.1f}%"

    @admin.display(description="Source Diversity", ordering="source_entropy")
    def display_source_entropy(self, obj):
        """Render normalized source diversity as a percentage."""

        return f"{_score_to_percent(obj.source_entropy):.1f}%"

    @admin.display(description="Author Diversity", ordering="author_entropy")
    def display_author_entropy(self, obj):
        """Render normalized author diversity as a percentage."""

        return f"{_score_to_percent(obj.author_entropy):.1f}%"

    @admin.display(description="Top Plugin Share", ordering="top_plugin_share")
    def display_top_plugin_share(self, obj):
        """Render the largest plugin share as a percentage."""

        return f"{_score_to_percent(obj.top_plugin_share):.1f}%"

    def changelist_view(self, request, extra_context=None):
        """Augment the changelist with diversity summaries and alert callouts."""

        queryset = self.get_queryset(request)
        changelist_url = reverse(
            f"{self.admin_site.name}:{self.model._meta.app_label}_{self.model._meta.model_name}_changelist"
        )
        metrics = queryset.aggregate(
            avg_plugin_entropy=Avg("plugin_entropy"),
            avg_source_entropy=Avg("source_entropy"),
            avg_author_entropy=Avg("author_entropy"),
            avg_top_plugin_share=Avg("top_plugin_share"),
            latest_snapshot_at=Max("computed_at"),
        )
        alerts = [
            alert
            for snapshot in queryset.order_by("project_id", "-computed_at")
            for alert in cast(
                list[dict[str, Any]], (snapshot.breakdown or {}).get("alerts", [])
            )
        ]

        extra_context = cast(dict[str, Any], extra_context or {})
        extra_context["dashboard_stats"] = [
            {
                "title": "Plugin Diversity",
                "value": (
                    f"{_score_to_percent(metrics['avg_plugin_entropy']):.1f}%"
                    if metrics["avg_plugin_entropy"] is not None
                    else "-"
                ),
                "icon": "hub",
                "color": _diversity_card_color(metrics["avg_plugin_entropy"]),
            },
            {
                "title": "Source Diversity",
                "value": (
                    f"{_score_to_percent(metrics['avg_source_entropy']):.1f}%"
                    if metrics["avg_source_entropy"] is not None
                    else "-"
                ),
                "icon": "lan",
                "color": _diversity_card_color(metrics["avg_source_entropy"]),
            },
            {
                "title": "Author Diversity",
                "value": (
                    f"{_score_to_percent(metrics['avg_author_entropy']):.1f}%"
                    if metrics["avg_author_entropy"] is not None
                    else "-"
                ),
                "icon": "group",
                "color": _diversity_card_color(metrics["avg_author_entropy"]),
            },
            {
                "title": "Top Plugin Share",
                "value": (
                    f"{_score_to_percent(metrics['avg_top_plugin_share']):.1f}%"
                    if metrics["avg_top_plugin_share"] is not None
                    else "-"
                ),
                "icon": "pie_chart",
                "color": _share_card_color(metrics["avg_top_plugin_share"]),
            },
        ]
        extra_context["source_diversity_alerts"] = alerts
        extra_context["source_diversity_project_drilldowns"] = (
            _build_source_diversity_project_drilldowns(queryset, changelist_url)
        )
        return super().changelist_view(request, extra_context=extra_context)
