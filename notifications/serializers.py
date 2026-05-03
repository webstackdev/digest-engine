"""DRF serializers for persistent user notifications."""

from rest_framework import serializers

from notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Serialize notification rows for the current authenticated user."""

    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "project",
            "level",
            "body",
            "link_path",
            "metadata",
            "created_at",
            "read_at",
            "is_read",
        ]
        read_only_fields = fields

    def get_is_read(self, obj: Notification) -> bool:
        """Return whether the serialized notification has been read."""

        return obj.is_read
