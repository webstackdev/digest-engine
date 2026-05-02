from types import SimpleNamespace

import pytest
from django.utils import timezone

from content.models import Content
from entities.extraction import run_entity_extraction
from entities.models import EntityCandidate, EntityCandidateEvidence
from projects.model_support import SourcePluginName
from projects.models import Project

pytestmark = pytest.mark.django_db


@pytest.fixture
def extraction_context():
    project = Project.objects.create(
        name="Extraction Project",
        topic_description="Infra",
    )
    content = Content.objects.create(
        project=project,
        url="https://www.linkedin.com/posts/river-labs-post",
        title="weekly infrastructure notes",
        author="River Labs",
        source_plugin=SourcePluginName.LINKEDIN,
        published_date=timezone.now(),
        content_text="River Labs shared its latest platform roadmap.",
        source_metadata={
            "author_profile_url": "https://www.linkedin.com/company/river-labs/",
        },
    )
    return SimpleNamespace(project=project, content=content)


def test_run_entity_extraction_persists_linkedin_candidate_identity_evidence(
    extraction_context,
    mocker,
    settings,
):
    settings.OPENROUTER_API_KEY = ""
    mocker.patch(
        "entities.extraction.search_similar_entities_for_content",
        return_value=[],
    )

    result = run_entity_extraction(extraction_context.content)

    candidate = EntityCandidate.objects.get(
        project=extraction_context.project,
        name="River Labs",
    )
    evidence = EntityCandidateEvidence.objects.get(candidate=candidate)

    assert any(
        candidate_payload["name"] == "River Labs"
        for candidate_payload in result["candidate_entities"]
    )
    assert evidence.source_plugin == SourcePluginName.LINKEDIN
    assert evidence.identity_surface == "linkedin"
    assert evidence.claim_url == "https://www.linkedin.com/company/river-labs"
    assert "River Labs" in evidence.context_excerpt
