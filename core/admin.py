"""Django admin configuration for the core editorial workflow.

These admin classes are intentionally richer than default CRUD screens. They expose
the health, traceability, and review information editors and operators need while
running ingestion and AI-assisted content curation.
"""

import json
from urllib.parse import urlencode

from django.contrib import admin, messages
from django.db.models import Avg, Max, QuerySet
from django.http import HttpRequest
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from unfold.admin import ModelAdmin

from core.entity_extraction import (
    accept_entity_candidate,
    merge_entity_candidate,
    reject_entity_candidate,
)
from core.models import (
    Content,
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityCandidateStatus,
    EntityMention,
    IngestionRun,
    ReviewQueue,
    SkillResult,
    TopicCentroidSnapshot,
    UserFeedback,
)
from core.plugins import get_plugin_for_source_config, validate_plugin_config


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
    """Build one filtered-history drilldown row per project.

    The changelist widget needs stable project links even on SQLite, so this keeps
    the grouping logic in Python instead of relying on database-specific distinct-on
    behavior.
    """

    latest_by_project: dict[int, TopicCentroidSnapshot] = {}
    snapshot_counts: dict[int, int] = {}
    ordered_snapshots = queryset.select_related("project").order_by(
        "project_id", "-computed_at"
    )

    for snapshot in ordered_snapshots:
        project_id = snapshot.project_id
        snapshot_counts[project_id] = snapshot_counts.get(project_id, 0) + 1
        latest_by_project.setdefault(project_id, snapshot)

    project_drilldowns = []
    for snapshot in sorted(
        latest_by_project.values(),
        key=lambda value: value.project.name.lower(),
    ):
        project_drilldowns.append(
            {
                "project_id": snapshot.project_id,
                "project_name": snapshot.project.name,
                "snapshot_count": snapshot_counts[snapshot.project_id],
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
                "href": f"{changelist_url}?{urlencode({'project__id__exact': snapshot.project_id})}",
            }
        )

    return project_drilldowns


@admin.register(Entity)
class EntityAdmin(admin.ModelAdmin):
    """Admin configuration for tracked people, vendors, and organizations."""

    list_display = (
        "name",
        "project",
        "type",
        "colored_score",
        "latest_snapshot_summary",
        "created_at",
    )
    search_fields = ("name", "project__name")

    @admin.display(description="Authority Score", ordering="authority_score")
    def colored_score(self, obj):
        """Render the authority score with a traffic-light color cue."""

        percent_value = _score_to_percent(obj.authority_score)
        color = _score_color(obj.authority_score)

        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            f"{percent_value:.1f}%",
        )

    @admin.display(description="Latest Snapshot")
    def latest_snapshot_summary(self, obj):
        """Show the latest authority component breakdown for an entity."""

        latest_snapshot = obj.authority_snapshots.order_by("-computed_at").first()
        if latest_snapshot is None:
            return "-"
        mention_value = f"{_score_to_percent(latest_snapshot.mention_component):.1f}%"
        feedback_value = f"{_score_to_percent(latest_snapshot.feedback_component):.1f}%"
        duplicate_value = (
            f"{_score_to_percent(latest_snapshot.duplicate_component):.1f}%"
        )
        decayed_value = f"{_score_to_percent(latest_snapshot.decayed_prior):.1f}%"
        return format_html(
            (
                '<span title="Mention {}, Feedback {}, Duplicate {}, Carry {}">'
                "M {} | F {} | D {} | Carry {}</span>"
            ),
            mention_value,
            feedback_value,
            duplicate_value,
            decayed_value,
            mention_value,
            feedback_value,
            duplicate_value,
            decayed_value,
        )


@admin.register(EntityAuthoritySnapshot)
class EntityAuthoritySnapshotAdmin(admin.ModelAdmin):
    """Admin view for persisted authority-score history."""

    list_display = (
        "entity",
        "project",
        "display_final_score",
        "display_components",
        "computed_at",
    )
    list_filter = (("project", admin.RelatedOnlyFieldListFilter), "computed_at")
    search_fields = ("entity__name", "project__name")
    autocomplete_fields = ("entity", "project")

    @admin.display(description="Final Score", ordering="final_score")
    def display_final_score(self, obj):
        """Render the recomputed final authority score as a percentage."""

        percent_value = _score_to_percent(obj.final_score)
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            _score_color(obj.final_score),
            f"{percent_value:.1f}%",
        )

    @admin.display(description="Components")
    def display_components(self, obj):
        """Render the stored authority components in a compact summary."""

        mention_value = f"{_score_to_percent(obj.mention_component):.1f}%"
        feedback_value = f"{_score_to_percent(obj.feedback_component):.1f}%"
        duplicate_value = f"{_score_to_percent(obj.duplicate_component):.1f}%"
        decayed_value = f"{_score_to_percent(obj.decayed_prior):.1f}%"
        return format_html(
            "M {} | F {} | D {} | Carry {}",
            mention_value,
            feedback_value,
            duplicate_value,
            decayed_value,
        )


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

        extra_context = extra_context or {}
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


@admin.register(EntityMention)
class EntityMentionAdmin(admin.ModelAdmin):
    """Admin view for extracted tracked-entity mentions."""

    list_display = (
        "entity",
        "project",
        "content",
        "role",
        "sentiment",
        "confidence",
        "created_at",
    )
    list_filter = ("role", "sentiment", ("project", admin.RelatedOnlyFieldListFilter))
    search_fields = ("entity__name", "content__title", "span")
    autocomplete_fields = ("entity", "content", "project")


@admin.register(EntityCandidate)
class EntityCandidateAdmin(admin.ModelAdmin):
    """Admin view for candidate entities awaiting human review."""

    actions = [
        "accept_selected_candidates",
        "reject_selected_candidates",
        "merge_into_existing_entities",
    ]
    list_display = (
        "name",
        "project",
        "suggested_type",
        "occurrence_count",
        "status",
        "merged_into",
        "first_seen_in",
        "created_at",
    )
    list_filter = (
        "status",
        "suggested_type",
        ("project", admin.RelatedOnlyFieldListFilter),
    )
    search_fields = ("name", "project__name", "merged_into__name")
    autocomplete_fields = ("project", "first_seen_in", "merged_into")
    ordering = ("-occurrence_count", "name")

    @admin.action(description="Accept selected candidates")
    def accept_selected_candidates(self, request, queryset):
        """Promote selected candidates into tracked entities."""

        accepted_count = 0
        for candidate in queryset.select_related("project"):
            if candidate.status == EntityCandidateStatus.ACCEPTED:
                continue
            accept_entity_candidate(candidate)
            accepted_count += 1
        self.message_user(
            request,
            f"Accepted {accepted_count} entity candidate(s).",
            messages.SUCCESS,
        )

    @admin.action(description="Reject selected candidates")
    def reject_selected_candidates(self, request, queryset):
        """Mark selected candidates as rejected."""

        rejected_count = 0
        for candidate in queryset:
            if candidate.status == EntityCandidateStatus.REJECTED:
                continue
            reject_entity_candidate(candidate)
            rejected_count += 1
        self.message_user(
            request,
            f"Rejected {rejected_count} entity candidate(s).",
            messages.SUCCESS,
        )

    @admin.action(description="Merge selected candidates into existing entities")
    def merge_into_existing_entities(
        self,
        request: HttpRequest,
        queryset: QuerySet[EntityCandidate],
    ) -> None:
        """Merge candidates when a same-name entity already exists in the project."""

        merged_count = 0
        unresolved_names: list[str] = []
        for candidate in queryset.select_related("project"):
            matching_entities = Entity.objects.filter(
                project=candidate.project,
                name__iexact=candidate.name,
            )
            if matching_entities.count() != 1:
                unresolved_names.append(candidate.name)
                continue
            merge_entity_candidate(candidate, matching_entities.get())
            merged_count += 1

        if merged_count:
            self.message_user(
                request,
                f"Merged {merged_count} entity candidate(s) into existing entities.",
                messages.SUCCESS,
            )
        if unresolved_names:
            self.message_user(
                request,
                "No unique same-name entity match was available for: "
                + ", ".join(sorted(unresolved_names)),
                messages.WARNING,
            )


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


@admin.register(Content)
class ContentAdmin(admin.ModelAdmin):
    """Admin view for curated content plus trace and score context."""

    list_display = (
        "display_relevance",
        "display_authority_adjusted_score",
        "duplicate_badge",
        "duplicate_parent",
        "is_active",
        "is_reference",
        "preview_content",
        "source_plugin",
        "project",
        "title",
        "view_trace",
    )
    list_editable = ("is_reference", "is_active")
    list_filter = (
        HighValueFilter,
        DuplicateStateFilter,
        ("project", admin.RelatedOnlyFieldListFilter),
        "source_plugin",
        "is_active",
    )
    search_fields = ("title", "author", "url")
    actions = ["generate_newsletter_ideas"]

    @admin.display(description="Preview")
    def preview_content(self, obj):
        """Adds a quick preview based on the stored content text."""
        preview_text = (obj.content_text or "").strip()
        if not preview_text:
            return "-"
        return format_html(
            '<span title="{}" style="cursor:pointer;">🔍 View</span>',
            preview_text[:500],
        )

    @admin.display(description="AI Trace")
    def view_trace(self, obj):
        """Link to the latest external trace or fall back to stored skill history."""
        from urllib.parse import urlencode

        from django.conf import settings
        from django.urls import reverse

        latest_skill_result = (
            obj.skill_results.filter(
                superseded_by__isnull=True,
            )
            .order_by("-created_at")
            .first()
        )
        if latest_skill_result is None:
            return "-"

        result_data = latest_skill_result.result_data or {}
        trace_sections = [result_data]
        for section_name in (
            "trace",
            "langsmith",
            "langfuse",
            "observability",
            "telemetry",
        ):
            section = result_data.get(section_name)
            if isinstance(section, dict):
                trace_sections.append(section)

        trace_url = ""
        trace_id = ""
        for section in trace_sections:
            for key in (
                "trace_url",
                "traceUrl",
                "langsmith_run_url",
                "langfuse_trace_url",
            ):
                value = section.get(key)
                if isinstance(value, str) and value:
                    trace_url = value
                    break
            if trace_url:
                break
            for key in (
                "trace_id",
                "traceId",
                "run_id",
                "runId",
                "langsmith_run_id",
                "langfuse_trace_id",
            ):
                value = section.get(key)
                if isinstance(value, str) and value:
                    trace_id = value
                    break

        if (
            not trace_url
            and trace_id
            and getattr(settings, "AI_TRACE_URL_TEMPLATE", "")
        ):
            trace_url = settings.AI_TRACE_URL_TEMPLATE.format(
                content_id=obj.id,
                run_id=trace_id,
                skill_name=latest_skill_result.skill_name,
                skill_result_id=latest_skill_result.id,
                project_id=obj.project_id,
                trace_id=trace_id,
            )

        if trace_url:
            link_label = "📈 Trace"
            link_title = f"Open external trace for {latest_skill_result.skill_name}"
        else:
            trace_url = "{}?{}".format(
                reverse("admin:core_skillresult_changelist"),
                urlencode({"content__id__exact": obj.id}),
            )
            link_label = "🧠 Skill runs"
            link_title = f"Open persisted skill runs for {obj.title}"

        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer" style="color: #a855f7; font-weight: bold;" title="{}">{}</a>',
            trace_url,
            link_title,
            link_label,
        )

    @admin.display(description="Base Score")
    def display_relevance(self, obj):
        """Render the relevance score with a coarse color-coded severity band."""

        if obj.relevance_score is None:
            return "-"
        percent_value = _score_to_percent(obj.relevance_score)
        return format_html(
            '<b style="color: {}">{}</b>',
            _score_color(obj.relevance_score),
            f"{percent_value:.1f}%",
        )

    @admin.display(description="Adjusted")
    def display_authority_adjusted_score(self, obj):
        """Render the authority-adjusted relevance score when available."""

        if obj.authority_adjusted_score is None:
            return "-"
        percent_value = _score_to_percent(obj.authority_adjusted_score)
        return format_html(
            '<b style="color: {}">{}</b>',
            _score_color(obj.authority_adjusted_score),
            f"{percent_value:.1f}%",
        )

    @admin.display(description="Duplicates", ordering="duplicate_signal_count")
    def duplicate_badge(self, obj):
        """Show how many duplicate sightings point at this content row."""

        if obj.duplicate_signal_count <= 0:
            return "-"
        return format_html(
            '<span style="font-weight: bold; color: #0f766e;">Also seen in {} source(s)</span>',
            obj.duplicate_signal_count,
        )

    @admin.display(description="Duplicate Of", ordering="duplicate_of")
    def duplicate_parent(self, obj):
        """Show the retained canonical content row when this item is a duplicate."""

        if obj.duplicate_of is None:
            return "-"
        return obj.duplicate_of.title

    def changelist_view(self, request, extra_context=None):
        """Augment the changelist with content dashboard statistics."""

        queryset = self.get_queryset(request)
        metrics = queryset.aggregate(
            avg_score=Avg("relevance_score"),
            avg_adjusted_score=Avg("authority_adjusted_score"),
        )

        extra_context = extra_context or {}
        extra_context["dashboard_stats"] = [
            {
                "title": "Avg Base Score",
                "value": (
                    f"{_score_to_percent(metrics['avg_score']):.1f}%"
                    if metrics["avg_score"] is not None
                    else "-"
                ),
                "icon": "insights",
                "color": (
                    "success"
                    if _score_color(metrics["avg_score"]) == "green"
                    else "warning"
                ),
            },
            {
                "title": "Avg Adjusted Score",
                "value": (
                    f"{_score_to_percent(metrics['avg_adjusted_score']):.1f}%"
                    if metrics["avg_adjusted_score"] is not None
                    else "-"
                ),
                "icon": "auto_graph",
                "color": (
                    "success"
                    if _score_color(metrics["avg_adjusted_score"]) == "green"
                    else "warning"
                ),
            },
            {
                "title": "Total Filtered",
                "value": queryset.count(),
                "icon": "inventory_2",
            },
        ]

        return super().changelist_view(request, extra_context=extra_context)

    @admin.action(description="Generate Ideas for Newsletter")
    def generate_newsletter_ideas(self, request, queryset):
        """Queue pipeline processing for the selected content items."""

        from core.tasks import process_content

        content_ids = list(queryset.values_list("id", flat=True))
        for content_id in content_ids:
            process_content.delay(content_id)
        self.message_user(
            request,
            f"Successfully queued the pipeline for {len(content_ids)} items.",
            messages.SUCCESS,
        )


@admin.register(SkillResult)
class SkillResultAdmin(ModelAdmin):
    """Admin view for AI skill history, retries, and result inspection."""

    list_display = (
        "skill_name",
        "get_content_link",
        "display_status",
        "display_performance",
        "preview_json",
        "is_current",
        "model_used",
        "created_at",
    )
    list_filter = ("status", "skill_name", "project", "model_used")
    search_fields = ("skill_name", "content__title", "model_used", "error_message")
    actions = ["retry_selected_skills"]
    readonly_fields = (
        "pretty_result_data",
        "latency_ms",
        "created_at",
        "superseded_by",
    )
    fieldsets = (
        (
            "Execution Details",
            {"fields": ("skill_name", "content", "project", "status", "model_used")},
        ),
        (
            "AI Output",
            {
                "fields": ("pretty_result_data", "error_message"),
            },
        ),
        (
            "Performance Metrics",
            {
                "fields": ("latency_ms", "confidence", "created_at", "superseded_by"),
            },
        ),
    )

    @admin.action(description="Retry Selected Skills")
    def retry_selected_skills(self, request, queryset):
        """Resets status to PENDING and clears errors for retry by the worker."""
        updated = queryset.update(status="pending", error_message="")
        self.message_user(
            request,
            f"Successfully reset {updated} skills to PENDING for retry.",
            messages.SUCCESS,
        )

    @admin.display(description="Result Preview")
    def preview_json(self, obj):
        """Link that triggers Unfold's detail view (can be opened in side-panel)."""
        if not obj.result_data:
            return "-"
        return format_html(
            '<a href="{}" class="font-bold text-primary-600">🔍 Preview</a>',
            f"{obj.pk}/change/",
        )

    @admin.display(description="Content")
    def get_content_link(self, obj):
        """Return a compact content title for the table view."""

        return obj.content.title[:30] + "..." if obj.content.title else "Untitled"

    @admin.display(description="Status")
    def display_status(self, obj):
        """Render the skill status as a colored dot plus label."""

        status_value = str(obj.status).lower()
        colors = {"completed": "green", "failed": "red", "pending": "orange"}
        color = colors.get(status_value, "gray")
        return format_html(
            '<span style="color: {}; font-weight: bold;">● {}</span>',
            color,
            status_value.upper(),
        )

    @admin.display(description="Perf / Conf")
    def display_performance(self, obj):
        """Show latency and confidence together in a compact cell."""

        latency = f"{obj.latency_ms}ms" if obj.latency_ms else "-"
        conf = f"{int(obj.confidence * 100)}%" if obj.confidence is not None else "-"
        return f"{latency} / {conf}"

    @admin.display(description="Current", boolean=True)
    def is_current(self, obj):
        """Return whether this row is the most recent non-superseded result."""

        return obj.superseded_by is None

    @admin.display(description="Result Data JSON")
    def pretty_result_data(self, obj):
        """Render result JSON in a readable preformatted block."""

        if not obj.result_data:
            return "No data available"
        formatted_json = json.dumps(obj.result_data, indent=4)
        return mark_safe(
            f'<pre style="background: #1e1e1e; color: #dcdcdc; padding: 15px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 13px;">'
            f"{formatted_json}"
            f"</pre>"
        )

    def changelist_view(self, request, extra_context=None):
        """Augment the changelist with latency and failure-rate statistics."""

        qs = self.get_queryset(request)
        extra_context = extra_context or {}
        metrics = qs.aggregate(avg_lat=Avg("latency_ms"))
        avg_latency = metrics["avg_lat"] or 0
        failure_count = qs.filter(status="failed").count()
        total_count = qs.count() or 1

        extra_context["dashboard_stats"] = [
            {
                "title": "Avg Latency",
                "value": f"{avg_latency:.0f}ms",
                "icon": "timer",
                "color": "warning" if avg_latency > 2000 else "success",
            },
            {
                "title": "Failure Rate",
                "value": f"{(failure_count / total_count) * 100:.1f}%",
                "icon": "error",
                "color": "danger" if failure_count > 0 else "success",
            },
        ]
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(UserFeedback)
class UserFeedbackAdmin(ModelAdmin):
    """Admin view for editorial feedback and agreement with AI scoring."""

    list_display = (
        "display_feedback",
        "get_content_title",
        "get_ai_score",
        "project",
        "user",
        "created_at",
    )
    list_filter = ("feedback_type", ("project", admin.RelatedOnlyFieldListFilter))
    search_fields = ("content__title", "user__email", "user__username")

    @admin.display(description="Type")
    def display_feedback(self, obj):
        """Render feedback as a thumbs-up or thumbs-down glyph."""

        if str(obj.feedback_type).lower() == "upvote":
            return format_html('<span style="font-size: {}">{}</span>', "1.2rem", "👍")
        return format_html('<span style="font-size: {}">{}</span>', "1.2rem", "👎")

    @admin.display(description="Content Title")
    def get_content_title(self, obj):
        """Return a shortened content title for list display."""

        return obj.content.title[:50] + "..."

    @admin.display(description="AI Score")
    def get_ai_score(self, obj):
        """Displays the original AI score to compare with user feedback."""
        score = obj.content.relevance_score
        if score is None:
            return "-"
        color = "green" if score > 75 else "red" if score < 40 else "orange"
        return format_html('<b style="color: {};">{}%</b>', color, score)

    def changelist_view(self, request, extra_context=None):
        """Augment the changelist with editorial approval statistics."""

        qs = self.get_queryset(request)
        extra_context = extra_context or {}
        upvotes = qs.filter(feedback_type="upvote").count()
        total = qs.count() or 1
        approval_rate = (upvotes / total) * 100

        extra_context["dashboard_stats"] = [
            {
                "title": "Approval Rate",
                "value": f"{approval_rate:.1f}%",
                "icon": "thumb_up",
                "color": "success" if approval_rate > 80 else "warning",
            },
            {
                "title": "Total Feedback",
                "value": total,
                "icon": "forum",
            },
        ]
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(IngestionRun)
class IngestionRunAdmin(ModelAdmin):
    """Admin view for ingestion health, throughput, and timing."""

    list_display = (
        "plugin_name",
        "project",
        "display_status",
        "display_efficiency",
        "display_duration",
        "started_at",
    )
    list_filter = (
        "plugin_name",
        "status",
        ("project", admin.RelatedOnlyFieldListFilter),
    )
    search_fields = ("plugin_name", "error_message", "project__name")
    readonly_fields = ("display_duration", "started_at", "completed_at")
    fieldsets = (
        ("Run Info", {"fields": ("plugin_name", "project", "status")}),
        (
            "Data Metrics",
            {"fields": ("items_fetched", "items_ingested", "display_efficiency")},
        ),
        ("Timing", {"fields": ("started_at", "completed_at", "display_duration")}),
        ("Logs", {"fields": ("error_message",), "classes": ("collapse",)}),
    )

    @admin.display(description="Status")
    def display_status(self, obj):
        """Render ingestion status as an Unfold badge."""

        status_value = str(obj.status).lower()
        colors = {"success": "success", "failed": "danger", "running": "info"}
        return format_html(
            '<span class="unfold-badge {}">{}</span>',
            colors.get(status_value, "warning"),
            status_value.upper(),
        )

    @admin.display(description="Efficiency (Ingested/Fetched)")
    def display_efficiency(self, obj):
        """Show how much of the fetched content became stored content."""

        if obj.items_fetched == 0:
            return "0/0"
        percent = (obj.items_ingested / obj.items_fetched) * 100
        color = "green" if percent > 90 else "orange" if percent > 50 else "red"
        percent_label = f"({percent:.0f}%)"
        return format_html(
            '<b>{} / {}</b> <small style="color: {}">{}</small>',
            obj.items_ingested,
            obj.items_fetched,
            color,
            percent_label,
        )

    @admin.display(description="Duration")
    def display_duration(self, obj):
        """Return human-readable runtime for completed ingestion runs."""

        if not obj.completed_at:
            return "In Progress..."
        duration = obj.completed_at - obj.started_at
        seconds = duration.total_seconds()
        return f"{int(seconds // 60)}m {int(seconds % 60)}s"

    def changelist_view(self, request, extra_context=None):
        """Augment the changelist with ingestion success statistics."""

        qs = self.get_queryset(request)
        extra_context = extra_context or {}
        total_runs = qs.count()
        failed_runs = qs.filter(status="failed").count()
        total_ingested = sum(qs.values_list("items_ingested", flat=True))

        extra_context["dashboard_stats"] = [
            {
                "title": "Total Content Ingested",
                "value": f"{total_ingested:,}",
                "icon": "cloud_download",
            },
            {
                "title": "Success Rate",
                "value": f"{((total_runs - failed_runs) / (total_runs or 1)) * 100:.1f}%",
                "icon": "check_circle",
                "color": "success" if failed_runs == 0 else "warning",
            },
        ]
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(ReviewQueue)
class ReviewQueueAdmin(ModelAdmin):
    """Admin view for items waiting on editorial judgment."""

    list_display = (
        "get_content_title",
        "project",
        "reason",
        "display_confidence",
        "resolved",
        "resolution",
        "created_at",
    )
    list_filter = ("resolved", "reason", ("project", admin.RelatedOnlyFieldListFilter))
    list_editable = ("resolved", "resolution")
    actions = ["mark_as_approved", "mark_as_rejected"]

    @admin.display(description="Content")
    def get_content_title(self, obj):
        """Return a shortened content title for list display."""

        return obj.content.title[:50] + "..."

    @admin.display(description="Confidence")
    def display_confidence(self, obj):
        """Render confidence as a percentage with risk coloring."""

        color = (
            "red"
            if obj.confidence < 0.3
            else "orange" if obj.confidence < 0.6 else "green"
        )
        confidence_label = f"{obj.confidence * 100:.0f}%"
        return format_html('<b style="color: {}">{}</b>', color, confidence_label)

    @admin.action(description="Approve selected items")
    def mark_as_approved(self, request, queryset):
        """Resolve selected review items as approved."""

        queryset.update(resolved=True, resolution="APPROVED")
        self.message_user(request, "Selected items approved.", messages.SUCCESS)

    @admin.action(description="Reject selected items")
    def mark_as_rejected(self, request, queryset):
        """Resolve selected review items as rejected."""

        queryset.update(resolved=True, resolution="REJECTED")
        self.message_user(request, "Selected items rejected.", messages.WARNING)

    def changelist_view(self, request, extra_context=None):
        """Augment the changelist with pending-volume and confidence stats."""

        qs = self.get_queryset(request)
        extra_context = extra_context or {}
        pending_count = qs.filter(resolved=False).count()
        avg_conf = qs.aggregate(avg_confidence=Avg("confidence"))["avg_confidence"] or 0

        extra_context["dashboard_stats"] = [
            {
                "title": "Pending Review",
                "value": pending_count,
                "icon": "pending_actions",
                "color": "danger" if pending_count > 10 else "success",
            },
            {
                "title": "Avg Confidence",
                "value": f"{avg_conf * 100:.0f}%",
                "icon": "psychology",
            },
        ]
        return super().changelist_view(request, extra_context=extra_context)


from projects.admin import (  # noqa: E402
    BlueskyCredentialsAdmin as ProjectsBlueskyCredentialsAdmin,
    BlueskyCredentialsAdminForm as ProjectsBlueskyCredentialsAdminForm,
    ProjectAdmin as ProjectsProjectAdmin,
    ProjectConfigAdmin as ProjectsProjectConfigAdmin,
    SourceConfigAdmin as ProjectsSourceConfigAdmin,
)

BlueskyCredentialsAdminForm = ProjectsBlueskyCredentialsAdminForm
ProjectAdmin = ProjectsProjectAdmin
BlueskyCredentialsAdmin = ProjectsBlueskyCredentialsAdmin
ProjectConfigAdmin = ProjectsProjectConfigAdmin


class SourceConfigAdmin(ProjectsSourceConfigAdmin):
    """Compatibility wrapper for the moved source-config admin class."""

    def test_source_connection(self, request, queryset):
        """Trigger a dry-run connectivity check for the selected sources."""

        healthy_sources = []
        failed_sources = []

        for source_config in queryset.select_related("project"):
            try:
                source_config.config = validate_plugin_config(
                    source_config.plugin_name,
                    source_config.config,
                )
                plugin = get_plugin_for_source_config(source_config)
                if not plugin.health_check():
                    raise RuntimeError("Health check returned an unhealthy status.")
            except Exception as exc:
                failed_sources.append(f"{source_config}: {exc}")
            else:
                healthy_sources.append(str(source_config))

        if healthy_sources:
            self.message_user(
                request,
                f"Connectivity check passed for {len(healthy_sources)} source(s).",
                messages.SUCCESS,
            )

        if failed_sources:
            self.message_user(
                request,
                "Connectivity check failed for: " + "; ".join(failed_sources),
                messages.ERROR,
            )
