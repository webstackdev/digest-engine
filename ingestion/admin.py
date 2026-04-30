"""Admin configuration for ingestion-domain models."""

from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin

from ingestion.models import IngestionRun


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
        (
            "Timing",
            {"fields": ("started_at", "completed_at", "display_duration")},
        ),
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
