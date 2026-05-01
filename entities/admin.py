"""Admin configuration for entity-domain models."""

from django.contrib import admin, messages
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils.html import format_html

from entities.extraction import (
    accept_entity_candidate,
    merge_entity_candidate,
    reject_entity_candidate,
)
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityCandidateStatus,
    EntityMention,
)


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
