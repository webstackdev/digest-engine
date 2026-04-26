from django.contrib import admin
from django.utils.html import format_html
from import_export.admin import ExportActionMixin

from core.models import (
    Content,
    Entity,
    IngestionRun,
    ReviewQueue,
    SkillResult,
    SourceConfig,
    Tenant,
    TenantConfig,
    UserFeedback,
)


@admin.register(Tenant)
class TenantAdmin(ExportActionMixin, admin.ModelAdmin):
    list_display = ("name", "user", "content_retention_days", "created_at")

    # Better navigation
    date_hierarchy = "created_at"
    list_filter = ("created_at",)

    # Faster searching
    search_fields = ("name", "user__username", "user__email")

    # Performance for large user lists
    autocomplete_fields = ("user",)

    # Quick editing
    list_editable = ("content_retention_days",)


@admin.register(TenantConfig)
class TenantConfigAdmin(admin.ModelAdmin):
	list_display = ("tenant", "upvote_authority_weight", "downvote_authority_weight", "authority_decay_rate")


@admin.register(Entity)
class EntityAdmin(admin.ModelAdmin):
    # Replace 'authority_score' with your new method name
    list_display = ("name", "tenant", "type", "colored_score", "created_at")

    @admin.display(description="Authority Score", ordering="authority_score")
    def colored_score(self, obj):
        # Choose a color based on the value
        if obj.authority_score >= 80:
            color = "green"
        elif obj.authority_score >= 50:
            color = "orange"
        else:
            color = "red"

        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.authority_score,
        )


@admin.register(Content)
class ContentAdmin(admin.ModelAdmin):
	list_display = ("title", "tenant", "source_plugin", "published_date", "relevance_score", "is_reference", "is_active")
	list_filter = ("tenant", "source_plugin", "is_reference", "is_active")
	search_fields = ("title", "author", "url")


@admin.register(SkillResult)
class SkillResultAdmin(admin.ModelAdmin):
	list_display = ("skill_name", "content", "tenant", "status", "model_used", "created_at")
	list_filter = ("status", "skill_name", "tenant")
	search_fields = ("skill_name", "content__title", "model_used")


@admin.register(UserFeedback)
class UserFeedbackAdmin(admin.ModelAdmin):
	list_display = ("content", "tenant", "user", "feedback_type", "created_at")
	list_filter = ("feedback_type", "tenant")


@admin.register(IngestionRun)
class IngestionRunAdmin(admin.ModelAdmin):
	list_display = ("plugin_name", "tenant", "status", "items_fetched", "items_ingested", "started_at")
	list_filter = ("plugin_name", "status", "tenant")


@admin.register(SourceConfig)
class SourceConfigAdmin(admin.ModelAdmin):
	list_display = ("plugin_name", "tenant", "is_active", "last_fetched_at")
	list_filter = ("plugin_name", "is_active", "tenant")


@admin.register(ReviewQueue)
class ReviewQueueAdmin(admin.ModelAdmin):
	list_display = ("content", "tenant", "reason", "confidence", "resolved", "created_at")
	list_filter = ("reason", "resolved", "tenant")
