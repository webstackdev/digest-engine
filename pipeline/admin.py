"""Admin configuration for pipeline-domain models."""

import json

from django.contrib import admin, messages
from django.db.models import Avg
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from unfold.admin import ModelAdmin

from pipeline.models import ReviewQueue, SkillResult


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
            {"fields": ("latency_ms", "confidence", "created_at", "superseded_by")},
        ),
    )

    @admin.action(description="Retry Selected Skills")
    def retry_selected_skills(self, request, queryset):
        """Reset status to pending and clear errors for retry by the worker."""

        updated = queryset.update(status="pending", error_message="")
        self.message_user(
            request,
            f"Successfully reset {updated} skills to PENDING for retry.",
            messages.SUCCESS,
        )

    @admin.display(description="Result Preview")
    def preview_json(self, obj):
        """Link that triggers Unfold's detail view."""

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
        avg_latency = qs.aggregate(avg_latency=Avg("latency_ms"))["avg_latency"]
        total_count = qs.count()
        failure_count = qs.filter(status__iexact="failed").count()

        extra_context["dashboard_stats"] = [
            {
                "title": "Avg Latency",
                "value": f"{avg_latency:.0f}ms" if avg_latency is not None else "-",
                "icon": "timer",
                "color": "warning" if avg_latency and avg_latency > 3000 else "success",
            },
            {
                "title": "Failure Rate",
                "value": (
                    f"{(failure_count / total_count) * 100:.1f}%"
                    if total_count
                    else "0.0%"
                ),
                "icon": "error",
                "color": "danger" if failure_count > 0 else "success",
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
