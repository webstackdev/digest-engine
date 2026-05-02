from types import SimpleNamespace

import pytest
from django.utils import timezone

from content.models import Content
from entities.models import (
    Entity,
    EntityCandidate,
    EntityCandidateEvidence,
    EntityCandidateStatus,
    EntityIdentityClaim,
)
from entities.tasks import (
    IdentityProbeResult,
    auto_promote_entity_candidates,
    cluster_entity_candidates,
    enrich_entity_identity,
)
from projects.model_support import SourcePluginName
from projects.models import Project

pytestmark = pytest.mark.django_db


@pytest.fixture
def entity_discovery_context():
    project = Project.objects.create(
        name="Discovery Project", topic_description="Infra"
    )
    return SimpleNamespace(project=project)


def _content(project: Project, *, suffix: str, source_plugin: str) -> Content:
    return Content.objects.create(
        project=project,
        url=f"https://example.com/{suffix}",
        title=f"{suffix} title",
        author="River Labs",
        source_plugin=source_plugin,
        published_date=timezone.now(),
        content_text=f"{suffix} content for River Labs.",
    )


def test_cluster_entity_candidates_groups_similar_candidates(
    entity_discovery_context,
    mocker,
):
    first_candidate = EntityCandidate.objects.create(
        project=entity_discovery_context.project,
        name="River Labs",
        suggested_type="vendor",
        occurrence_count=3,
    )
    second_candidate = EntityCandidate.objects.create(
        project=entity_discovery_context.project,
        name="River Lab",
        suggested_type="vendor",
        occurrence_count=2,
    )
    third_candidate = EntityCandidate.objects.create(
        project=entity_discovery_context.project,
        name="Acme Security",
        suggested_type="vendor",
        occurrence_count=2,
    )
    mocker.patch(
        "entities.tasks.embed_text",
        side_effect=lambda text: {
            "River Labs": [1.0, 0.0],
            "River Lab": [0.98, 0.02],
            "Acme Security": [0.0, 1.0],
        }.get(text.split("\n\n")[0], [0.5, 0.5]),
    )

    result = cluster_entity_candidates(entity_discovery_context.project.id)

    first_candidate.refresh_from_db()
    second_candidate.refresh_from_db()
    third_candidate.refresh_from_db()

    assert result["clusters_created"] == 2
    assert first_candidate.cluster_key == second_candidate.cluster_key
    assert first_candidate.cluster_key != third_candidate.cluster_key
    assert first_candidate.contextual_embedding_id is not None


def test_auto_promote_entity_candidates_promotes_verified_multi_source_candidate(
    entity_discovery_context,
    settings,
    mocker,
):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    candidate = EntityCandidate.objects.create(
        project=entity_discovery_context.project,
        name="River Labs",
        suggested_type="vendor",
        occurrence_count=5,
    )
    contents = [
        _content(
            entity_discovery_context.project,
            suffix=f"item-{index}",
            source_plugin=plugin,
        )
        for index, plugin in enumerate(
            [
                SourcePluginName.LINKEDIN,
                SourcePluginName.RSS,
                SourcePluginName.LINKEDIN,
                SourcePluginName.RSS,
                SourcePluginName.LINKEDIN,
            ],
            start=1,
        )
    ]
    for content in contents:
        EntityCandidateEvidence.objects.create(
            candidate=candidate,
            project=entity_discovery_context.project,
            content=content,
            source_plugin=content.source_plugin,
            context_excerpt=f"{candidate.name} context from {content.source_plugin}",
            identity_surface=(
                "linkedin" if content.source_plugin == SourcePluginName.LINKEDIN else ""
            ),
            claim_url=(
                "https://www.linkedin.com/company/river-labs"
                if content.source_plugin == SourcePluginName.LINKEDIN
                else ""
            ),
        )
    mocker.patch(
        "entities.tasks._candidate_disambiguation_confidence", return_value=0.9
    )
    mocker.patch(
        "entities.tasks._probe_identity_claim",
        return_value=IdentityProbeResult(
            claim_url="https://www.linkedin.com/company/river-labs",
            verification_method="linkedin_profile_url",
            field_updates={
                "linkedin_url": "https://www.linkedin.com/company/river-labs"
            },
        ),
    )

    result = auto_promote_entity_candidates(entity_discovery_context.project.id)

    candidate.refresh_from_db()
    entity = Entity.objects.get(
        project=entity_discovery_context.project, name="River Labs"
    )
    claim = EntityIdentityClaim.objects.get(entity=entity, surface="linkedin")

    assert result["promoted"] == 1
    assert candidate.status == EntityCandidateStatus.ACCEPTED
    assert candidate.merged_into == entity
    assert entity.linkedin_url == "https://www.linkedin.com/company/river-labs"
    assert claim.verified is True


def test_enrich_entity_identity_uses_github_profile_probe(
    entity_discovery_context,
    mocker,
):
    entity = Entity.objects.create(
        project=entity_discovery_context.project,
        name="River Labs",
        type="vendor",
    )
    claim = EntityIdentityClaim.objects.create(
        entity=entity,
        surface="github",
        claim_url="https://github.com/river-labs",
        verified=True,
        verification_method="candidate_evidence",
    )
    github_response = mocker.Mock()
    github_response.raise_for_status.return_value = None
    github_response.json.return_value = {
        "html_url": "https://github.com/river-labs",
        "blog": "https://riverlabs.dev",
        "name": "River Labs",
        "bio": "Cloud infrastructure tooling.",
        "company": "River Labs",
        "location": "Remote",
    }
    mocker.patch("entities.tasks.httpx.get", return_value=github_response)

    result = enrich_entity_identity(entity.id)

    entity.refresh_from_db()
    claim.refresh_from_db()

    assert result["claims_considered"] == 1
    assert entity.github_url == "https://github.com/river-labs"
    assert entity.website_url == "https://riverlabs.dev"
    assert "Cloud infrastructure tooling." in entity.description
    assert claim.verification_method == "github_api"


def test_enrich_entity_identity_uses_bluesky_profile_probe(
    entity_discovery_context,
    mocker,
):
    entity = Entity.objects.create(
        project=entity_discovery_context.project,
        name="River Labs",
        type="vendor",
    )
    claim = EntityIdentityClaim.objects.create(
        entity=entity,
        surface="bluesky",
        claim_url="https://bsky.app/profile/riverlabs.bsky.social",
        verified=True,
        verification_method="candidate_evidence",
    )
    bluesky_client = mocker.Mock()
    bluesky_client.app.bsky.actor.get_profile.return_value = SimpleNamespace(
        handle="riverlabs.bsky.social",
        description="Infra notes from River Labs.",
    )
    mocker.patch("entities.tasks.Client", return_value=bluesky_client)

    result = enrich_entity_identity(entity.id)

    entity.refresh_from_db()
    claim.refresh_from_db()

    assert result["claims_considered"] == 1
    assert entity.bluesky_handle == "riverlabs.bsky.social"
    assert entity.description == "Infra notes from River Labs."
    assert claim.verification_method == "bluesky_appview"


def test_auto_promote_entity_candidates_blocks_single_source_candidates(
    entity_discovery_context,
    mocker,
):
    candidate = EntityCandidate.objects.create(
        project=entity_discovery_context.project,
        name="Single Source Vendor",
        suggested_type="vendor",
        occurrence_count=5,
    )
    for index in range(5):
        content = _content(
            entity_discovery_context.project,
            suffix=f"single-{index}",
            source_plugin=SourcePluginName.RSS,
        )
        EntityCandidateEvidence.objects.create(
            candidate=candidate,
            project=entity_discovery_context.project,
            content=content,
            source_plugin=content.source_plugin,
            context_excerpt=f"Single Source Vendor context {index}",
        )
    mocker.patch(
        "entities.tasks._candidate_disambiguation_confidence", return_value=0.9
    )

    result = auto_promote_entity_candidates(entity_discovery_context.project.id)

    candidate.refresh_from_db()

    assert result["blocked"] == 1
    assert candidate.status == EntityCandidateStatus.PENDING
    assert candidate.auto_promotion_blocked_reason == "needs_more_source_diversity"
