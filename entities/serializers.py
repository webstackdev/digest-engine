"""DRF serializers for entity-domain models."""

from rest_framework import serializers

from core.serializer_mixins import ProjectScopedSerializerMixin
from entities.models import (
    Entity,
    EntityAuthoritySnapshot,
    EntityCandidate,
    EntityIdentityClaim,
    EntityMention,
)


class EntityIdentityClaimSerializer(serializers.ModelSerializer):
    """Serialize one verified external identity claim for a tracked entity."""

    class Meta:
        model = EntityIdentityClaim
        fields = [
            "id",
            "surface",
            "claim_url",
            "verified",
            "verified_at",
            "verification_method",
        ]
        read_only_fields = fields


class EntitySerializer(ProjectScopedSerializerMixin, serializers.ModelSerializer):
    """Serialize tracked entities for a project."""

    identity_claims = EntityIdentityClaimSerializer(many=True, read_only=True)
    mention_count = serializers.IntegerField(read_only=True)
    latest_mentions = serializers.SerializerMethodField()

    class Meta:
        model = Entity
        fields = [
            "id",
            "project",
            "name",
            "type",
            "description",
            "authority_score",
            "website_url",
            "github_url",
            "linkedin_url",
            "bluesky_handle",
            "mastodon_handle",
            "twitter_handle",
            "identity_claims",
            "mention_count",
            "latest_mentions",
            "created_at",
        ]
        read_only_fields = ["id", "project", "created_at"]

    def get_latest_mentions(self, obj):
        """Return a compact summary of the most recent mentions for an entity."""

        mentions = getattr(obj, "prefetched_mentions", None)
        if mentions is None:
            mentions = obj.mentions.select_related("content").order_by("-created_at")
        return EntityMentionSummarySerializer(mentions[:3], many=True).data


class EntityAuthoritySnapshotSerializer(serializers.ModelSerializer):
    """Serialize one persisted authority recomputation for an entity."""

    class Meta:
        model = EntityAuthoritySnapshot
        fields = [
            "id",
            "entity",
            "project",
            "computed_at",
            "mention_component",
            "engagement_component",
            "recency_component",
            "source_quality_component",
            "cross_newsletter_component",
            "feedback_component",
            "duplicate_component",
            "decayed_prior",
            "weights_at_compute",
            "final_score",
        ]
        read_only_fields = fields


class EntityMentionSummarySerializer(serializers.ModelSerializer):
    """Serialize a compact entity-mention summary for frontend display."""

    content_id = serializers.IntegerField(read_only=True)
    content_title = serializers.CharField(source="content.title", read_only=True)

    class Meta:
        model = EntityMention
        fields = [
            "id",
            "content_id",
            "content_title",
            "role",
            "sentiment",
            "span",
            "confidence",
            "created_at",
        ]
        read_only_fields = fields


class EntityCandidateSerializer(
    ProjectScopedSerializerMixin, serializers.ModelSerializer
):
    """Serialize extracted entity candidates awaiting editorial review."""

    first_seen_title = serializers.CharField(
        source="first_seen_in.title", read_only=True
    )
    merged_into_name = serializers.CharField(source="merged_into.name", read_only=True)
    evidence_count = serializers.SerializerMethodField()
    source_plugin_count = serializers.SerializerMethodField()
    source_plugins = serializers.SerializerMethodField()
    identity_surfaces = serializers.SerializerMethodField()

    class Meta:
        model = EntityCandidate
        fields = [
            "id",
            "project",
            "name",
            "suggested_type",
            "first_seen_in",
            "first_seen_title",
            "occurrence_count",
            "cluster_key",
            "auto_promotion_blocked_reason",
            "evidence_count",
            "source_plugin_count",
            "source_plugins",
            "identity_surfaces",
            "status",
            "merged_into",
            "merged_into_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def _candidate_evidence(self, obj):
        """Return prefetched evidence rows when available."""

        evidence = getattr(obj, "prefetched_evidence", None)
        if evidence is None:
            evidence = obj.evidence.all()
        return evidence

    def get_evidence_count(self, obj) -> int:
        """Return the number of evidence rows attached to the candidate."""

        return len(self._candidate_evidence(obj))

    def get_source_plugin_count(self, obj) -> int:
        """Return the number of unique source plugins backing the candidate."""

        return len(self.get_source_plugins(obj))

    def get_source_plugins(self, obj) -> list[str]:
        """Return the unique source plugins seen in candidate evidence."""

        return sorted(
            {
                evidence.source_plugin
                for evidence in self._candidate_evidence(obj)
                if evidence.source_plugin
            }
        )

    def get_identity_surfaces(self, obj) -> list[str]:
        """Return the unique identity surfaces hinted by candidate evidence."""

        return sorted(
            {
                evidence.identity_surface
                for evidence in self._candidate_evidence(obj)
                if evidence.identity_surface
            }
        )


class EntityCandidateMergeSerializer(
    ProjectScopedSerializerMixin, serializers.Serializer
):
    """Validate merge requests for entity candidates."""

    merged_into = serializers.PrimaryKeyRelatedField(queryset=Entity.objects.none())
