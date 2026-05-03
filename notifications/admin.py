"""Admin registrations for persistent notifications."""

from django.contrib import admin
from django.utils import timezone

from notifications.models import Notification


@admin.action(description="Mark selected notifications as read")
def mark_notifications_read(modeladmin, request, queryset):
    """Bulk-mark the selected notifications as read."""

    queryset.filter(read_at__isnull=True).update(read_at=timezone.now())


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Read-mostly admin configuration for the notification inbox."""

    actions = [mark_notifications_read]
    list_display = ["id", "user", "project", "level", "body", "created_at", "read_at"]
    list_filter = ["level", "read_at", "created_at"]
    search_fields = ["user__username", "user__email", "body"]
    autocomplete_fields = ["user", "project"]
    ordering = ["-created_at"]
