"""Admin registrations for direct-message models."""

from django.contrib import admin

from messaging.models import DirectMessage, Thread, ThreadParticipant


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    """Audit thread state in Django admin."""

    list_display = ("id", "last_message_at", "created_at")
    search_fields = ("id",)


@admin.register(ThreadParticipant)
class ThreadParticipantAdmin(admin.ModelAdmin):
    """Audit per-user thread participation state."""

    list_display = ("thread", "user", "last_read_at")
    list_filter = ("last_read_at",)
    search_fields = ("user__username", "user__email")


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    """Audit direct-message rows in Django admin."""

    list_display = ("id", "thread", "sender", "created_at")
    list_filter = ("created_at",)
    search_fields = ("sender__username", "body")
