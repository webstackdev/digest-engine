from django.contrib import admin, messages
from django.db.models import Avg
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
from core.tasks import process_content


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


class HighValueFilter(admin.SimpleListFilter):
    title = 'Content Value'
    parameter_name = 'value_tier'

    def lookups(self, request, model_admin):
        return (
            ('high_value', '🔥 High Value (Score > 80 & Reference)'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'high_value':
            return queryset.filter(relevance_score__gt=80, is_reference=True)
        return queryset


@admin.register(Content)
class ContentAdmin(admin.ModelAdmin):
    # Core view settings
    list_display = ("title", "tenant", "display_relevance", "source_plugin", "is_reference", "is_active")
    list_editable = ("is_reference", "is_active")
    list_filter = (
        HighValueFilter,
        ("tenant", admin.RelatedOnlyFieldListFilter),
        "source_plugin",
        "is_active"
    )
    search_fields = ("title", "author", "url")
    actions = ["generate_newsletter_ideas"]

    @admin.display(description="Score")
    def display_relevance(self, obj):
        if obj.relevance_score is None:
            return "-"
        color = "green" if obj.relevance_score > 75 else "orange" if obj.relevance_score > 40 else "red"
        return format_html('<b style="color: {};">{}%</b>', color, obj.relevance_score)

    def changelist_view(self, request, extra_context=None):
        queryset = self.get_queryset(request)
        metrics = queryset.aggregate(avg_score=Avg('relevance_score'))

        extra_context = extra_context or {}
        extra_context["dashboard_stats"] = [
            {
                "title": "Avg Relevance",
                "value": f"{metrics['avg_score'] or 0:.1f}%",
                "icon": "insights",
                "color": "success" if (metrics['avg_score'] or 0) > 70 else "warning",
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
        content_ids = list(queryset.values_list("id", flat=True))
        for content_id in content_ids:
            process_content.delay(content_id)
        self.message_user(
            request,
            f"Successfully queued the pipeline for {len(content_ids)} items.",
            messages.SUCCESS,
        )



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
