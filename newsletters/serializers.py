"""DRF serializers for newsletter-domain models."""

from rest_framework import serializers

from core.serializer_mixins import ProjectScopedSerializerMixin
from newsletters.models import (
    IntakeAllowlist,
    NewsletterDraft,
    NewsletterDraftItem,
    NewsletterDraftOriginalPiece,
    NewsletterDraftSection,
    NewsletterIntake,
)


class IntakeAllowlistSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize confirmed and pending newsletter sender allowlist entries."""

    is_confirmed = serializers.BooleanField(read_only=True)

    class Meta:
        model = IntakeAllowlist
        fields = [
            "id",
            "project",
            "sender_email",
            "is_confirmed",
            "confirmed_at",
            "confirmation_token",
            "created_at",
        ]
        read_only_fields = ["id", "project", "confirmation_token", "created_at"]


class NewsletterIntakeSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize raw inbound newsletter messages captured for a project."""

    class Meta:
        model = NewsletterIntake
        fields = [
            "id",
            "project",
            "sender_email",
            "subject",
            "received_at",
            "raw_html",
            "raw_text",
            "message_id",
            "status",
            "extraction_result",
            "error_message",
        ]
        read_only_fields = [
            "id",
            "project",
            "received_at",
            "status",
            "extraction_result",
            "error_message",
        ]


class NewsletterDraftItemContentSerializer(serializers.Serializer):
    """Serialize minimal content metadata embedded in draft items."""

    id = serializers.IntegerField()
    url = serializers.URLField()
    title = serializers.CharField()
    source_plugin = serializers.CharField()
    published_date = serializers.DateTimeField()


class NewsletterDraftItemSerializer(serializers.ModelSerializer):
    """Serialize one editable draft item under a newsletter section."""

    content_detail = NewsletterDraftItemContentSerializer(
        source="content", read_only=True
    )

    class Meta:
        model = NewsletterDraftItem
        fields = [
            "id",
            "section",
            "content",
            "content_detail",
            "summary_used",
            "why_it_matters",
            "order",
        ]
        read_only_fields = ["id", "section", "content", "content_detail"]


class NewsletterDraftSectionThemeSerializer(serializers.Serializer):
    """Serialize the accepted theme linked to a draft section."""

    id = serializers.IntegerField()
    title = serializers.CharField()
    pitch = serializers.CharField()
    why_it_matters = serializers.CharField()


class NewsletterDraftSectionSerializer(serializers.ModelSerializer):
    """Serialize one editable newsletter draft section."""

    items = NewsletterDraftItemSerializer(many=True, read_only=True)
    theme_suggestion_detail = NewsletterDraftSectionThemeSerializer(
        source="theme_suggestion",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = NewsletterDraftSection
        fields = [
            "id",
            "draft",
            "theme_suggestion",
            "theme_suggestion_detail",
            "title",
            "lede",
            "order",
            "items",
        ]
        read_only_fields = [
            "id",
            "draft",
            "theme_suggestion",
            "theme_suggestion_detail",
            "items",
        ]


class NewsletterDraftOriginalIdeaSerializer(serializers.Serializer):
    """Serialize the accepted idea linked to a draft original piece."""

    id = serializers.IntegerField()
    angle_title = serializers.CharField()
    summary = serializers.CharField()
    suggested_outline = serializers.CharField()


class NewsletterDraftOriginalPieceSerializer(serializers.ModelSerializer):
    """Serialize one editable original-content block in a draft."""

    idea_detail = NewsletterDraftOriginalIdeaSerializer(source="idea", read_only=True)

    class Meta:
        model = NewsletterDraftOriginalPiece
        fields = [
            "id",
            "draft",
            "idea",
            "idea_detail",
            "title",
            "pitch",
            "suggested_outline",
            "order",
        ]
        read_only_fields = ["id", "draft", "idea", "idea_detail"]


class NewsletterDraftSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize one newsletter draft and its nested editable tree."""

    sections = NewsletterDraftSectionSerializer(many=True, read_only=True)
    original_pieces = NewsletterDraftOriginalPieceSerializer(many=True, read_only=True)
    rendered_markdown = serializers.SerializerMethodField()
    rendered_html = serializers.SerializerMethodField()

    class Meta:
        model = NewsletterDraft
        fields = [
            "id",
            "project",
            "title",
            "intro",
            "outro",
            "target_publish_date",
            "status",
            "generated_at",
            "last_edited_at",
            "generation_metadata",
            "sections",
            "original_pieces",
            "rendered_markdown",
            "rendered_html",
        ]
        read_only_fields = [
            "id",
            "project",
            "generated_at",
            "last_edited_at",
            "generation_metadata",
            "sections",
            "original_pieces",
            "rendered_markdown",
            "rendered_html",
        ]

    def get_rendered_markdown(self, obj: NewsletterDraft) -> str:
        """Render the draft tree into Markdown for API consumers."""

        return obj.render_markdown()

    def get_rendered_html(self, obj: NewsletterDraft) -> str:
        """Render the draft tree into HTML for API consumers."""

        return obj.render_html()


class NewsletterDraftRegenerateSectionSerializer(serializers.Serializer):
    """Validate per-section regeneration requests for an existing draft."""

    section_id = serializers.IntegerField()

    def validate_section_id(self, value: int) -> int:
        """Ensure the selected section belongs to the current project and draft."""

        project = self.context["project"]
        draft = self.context["draft"]
        exists = NewsletterDraftSection.objects.filter(
            pk=value,
            draft=draft,
            draft__project=project,
        ).exists()
        if not exists:
            raise serializers.ValidationError(
                "Draft section not found for this project."
            )
        return value
