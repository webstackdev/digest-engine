"""Admin configuration for content-domain models."""

from django.contrib import admin, messages
from django.db.models import Avg
from django.utils.html import format_html
from unfold.admin import ModelAdmin

from content.models import Content, UserFeedback


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
        """Add a quick preview based on the stored content text."""

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
            obj.skill_results.filter(superseded_by__isnull=True)
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
                reverse(
                    "admin:{}_{}_changelist".format(
                        latest_skill_result._meta.app_label,
                        latest_skill_result._meta.model_name,
                    )
                ),
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
        """Display the original AI score to compare with user feedback."""

        score = obj.content.relevance_score
        if score is None:
            return "-"
        color = "green" if score > 75 else "red" if score < 40 else "orange"
        return format_html('<b style="color: {}">{}%</b>', color, score)

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
