"""DRF serializers for newsletter-domain models."""

from rest_framework import serializers

from core.serializer_mixins import ProjectScopedSerializerMixin
from newsletters.models import IntakeAllowlist, NewsletterIntake


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
