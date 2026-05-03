"""Admin configuration for newsletter intake and sender allowlists."""

import json
from typing import Any, cast

from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from unfold.admin import ModelAdmin

from newsletters.models import IntakeAllowlist, NewsletterIntake


@admin.register(IntakeAllowlist)
class IntakeAllowlistAdmin(ModelAdmin):
    """Admin view for project newsletter sender allowlists."""

    list_display = (
        "sender_email",
        "project",
        "confirmation_state",
        "confirmed_at",
        "created_at",
    )
    list_filter = (
        ("project", admin.RelatedOnlyFieldListFilter),
        "confirmed_at",
    )
    search_fields = ("sender_email", "project__name")
    readonly_fields = ("confirmation_token", "created_at")

    @admin.display(description="Confirmed")
    def confirmation_state(self, obj):
        """Render allowlist confirmation state as a compact badge."""

        if obj.is_confirmed:
            return format_html(
                '<span class="unfold-badge {}">{}</span>',
                "success",
                "CONFIRMED",
            )
        return format_html(
            '<span class="unfold-badge {}">{}</span>',
            "warning",
            "PENDING",
        )


@admin.register(NewsletterIntake)
class NewsletterIntakeAdmin(ModelAdmin):
    """Admin view for inbound newsletter audit and extraction results."""

    list_display = (
        "subject",
        "project",
        "sender_email",
        "display_status",
        "received_at",
    )
    list_filter = (
        "status",
        ("project", admin.RelatedOnlyFieldListFilter),
    )
    search_fields = (
        "subject",
        "sender_email",
        "message_id",
        "error_message",
    )
    readonly_fields = (
        "received_at",
        "message_id",
        "pretty_extraction_result",
    )
    fieldsets = (
        (
            "Intake",
            {
                "fields": (
                    "project",
                    "sender_email",
                    "subject",
                    "status",
                    "received_at",
                    "message_id",
                )
            },
        ),
        (
            "Payload",
            {"fields": ("raw_html", "raw_text")},
        ),
        (
            "Extraction",
            {"fields": ("pretty_extraction_result", "error_message")},
        ),
    )

    @admin.display(description="Status")
    def display_status(self, obj):
        """Render intake status as an Unfold badge."""

        status_value = str(obj.status).lower()
        colors = {
            "pending": "warning",
            "extracted": "success",
            "failed": "danger",
            "rejected": "danger",
        }
        return format_html(
            '<span class="unfold-badge {}">{}</span>',
            colors.get(status_value, "info"),
            status_value.upper(),
        )

    @admin.display(description="Extraction Result JSON")
    def pretty_extraction_result(self, obj):
        """Render extraction metadata in a readable preformatted block."""

        if not obj.extraction_result:
            return "No extraction result recorded"
        formatted_json = json.dumps(obj.extraction_result, indent=4)
        return mark_safe(
            '<pre style="background: #1e1e1e; color: #dcdcdc; padding: 15px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 13px;">'
            f"{formatted_json}"
            "</pre>"
        )

    def changelist_view(self, request, extra_context=None):
        """Augment the changelist with intake status summary cards."""

        queryset = self.get_queryset(request)
        extra_context = cast(dict[str, Any], extra_context or {})
        total_count = queryset.count()
        extracted_count = queryset.filter(status="extracted").count()
        failed_count = queryset.filter(status__in=["failed", "rejected"]).count()

        extra_context["dashboard_stats"] = [
            {
                "title": "Recorded Intakes",
                "value": f"{total_count}",
                "icon": "mail",
            },
            {
                "title": "Extracted",
                "value": f"{extracted_count}",
                "icon": "check_circle",
                "color": "success",
            },
            {
                "title": "Failed or Rejected",
                "value": f"{failed_count}",
                "icon": "error",
                "color": "danger" if failed_count else "success",
            },
        ]
        return super().changelist_view(request, extra_context=extra_context)
