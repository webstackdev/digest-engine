from types import SimpleNamespace

import pytest
from django.db.models import Model

from content.deduplication import canonicalize_url
from core.pipeline import (
    CLASSIFICATION_SKILL_NAME,
    DEDUPLICATION_SKILL_NAME,
    ENTITY_EXTRACTION_SKILL_NAME,
    RELATED_CONTENT_SKILL_NAME,
    RELEVANCE_SKILL_NAME,
    SUMMARIZATION_SKILL_NAME,
    _clamp_score,
    _execute_with_retries,
    _heuristic_summary,
    _normalize_summary,
    _run_ad_hoc_relevance,
    _serialize_related_match,
    create_pending_skill_result,
    execute_ad_hoc_skill,
    execute_background_skill_result,
    get_skill_definition,
    retry_review_queue_item,
    route_by_relevance,
    run_content_classification,
    run_deduplication,
    run_entity_extraction,
    run_relevance_scoring,
    run_summarization,
)
from core.tasks import process_content
from content.models import Content, ContentPipelineState
from entities.models import (
    Entity,
    EntityCandidate,
    EntityMention,
    EntityMentionRole,
)
from pipeline.models import ReviewQueue, ReviewReason, SkillResult, SkillStatus
from projects.models import Project

pytestmark = pytest.mark.django_db


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed pipeline assertions."""

    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


@pytest.fixture
def pipeline_context(django_user_model):
    user = django_user_model.objects.create_user(
        username="pipeline-owner", password="testpass123"
    )
    project = Project.objects.create(
        name="Pipeline Project", topic_description="Platform engineering"
    )
    content = Content.objects.create(
        project=project,
        url="https://example.com/article",
        title="Kubernetes Release Notes",
        author="Editor",
        source_plugin="rss",
        published_date="2026-04-26T00:00:00Z",
        content_text="This article covers a new Kubernetes release and what changed for platform teams.",
        embedding_id="emb_123",
    )
    return SimpleNamespace(user=user, project=project, content=content)


def test_process_content_runs_full_pipeline_for_relevant_content(
    pipeline_context, mocker
):
    pipeline_context.content.entity = Entity.objects.create(
        project=pipeline_context.project,
        name="Platform Weekly",
        type="organization",
        authority_score=0.9,
    )
    pipeline_context.content.save(update_fields=["entity"])
    mocker.patch(
        "core.pipeline.run_content_classification",
        return_value={
            "content_type": "release_notes",
            "confidence": 0.9,
            "explanation": "High confidence classification.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": 0.92,
            "explanation": "Very close to the project reference corpus.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_entity_extraction",
        return_value={
            "mentions": [],
            "candidate_entities": [],
            "primary_entity_id": pipeline_context.content.entity_id,
            "confidence": 0.0,
            "explanation": "No extracted entity mentions.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_summarization",
        return_value={
            "summary": "A concise summary for the editor.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )

    result = process_content(_require_pk(pipeline_context.content))

    pipeline_context.content.refresh_from_db()
    assert result["status"] == "completed"
    assert pipeline_context.content.content_type == "release_notes"
    assert pipeline_context.content.relevance_score == pytest.approx(0.92)
    assert pipeline_context.content.authority_adjusted_score == pytest.approx(1.0)
    assert pipeline_context.content.summary_text == "A concise summary for the editor."
    assert pipeline_context.content.is_active is True
    assert (
        SkillResult.objects.filter(
            content=pipeline_context.content, skill_name=CLASSIFICATION_SKILL_NAME
        ).count()
        == 1
    )
    assert (
        SkillResult.objects.filter(
            content=pipeline_context.content, skill_name=RELEVANCE_SKILL_NAME
        ).count()
        == 1
    )
    assert (
        SkillResult.objects.filter(
            content=pipeline_context.content, skill_name=SUMMARIZATION_SKILL_NAME
        ).count()
        == 1
    )
    assert ReviewQueue.objects.filter(content=pipeline_context.content).count() == 0


def test_process_content_uses_top_entity_mention_for_authority_adjustment(
    pipeline_context, mocker
):
    mentioned_entity = Entity.objects.create(
        project=pipeline_context.project,
        name="Mentioned Vendor",
        type="vendor",
        authority_score=0.8,
    )
    quoted_entity = Entity.objects.create(
        project=pipeline_context.project,
        name="Quoted Source",
        type="individual",
        authority_score=0.95,
    )
    EntityMention.objects.create(
        project=pipeline_context.project,
        content=pipeline_context.content,
        entity=mentioned_entity,
        role=EntityMentionRole.MENTIONED,
        sentiment="neutral",
        span="Mentioned Vendor",
        confidence=0.99,
    )
    EntityMention.objects.create(
        project=pipeline_context.project,
        content=pipeline_context.content,
        entity=quoted_entity,
        role=EntityMentionRole.QUOTED,
        sentiment="neutral",
        span="Quoted Source",
        confidence=0.50,
    )
    mocker.patch(
        "core.pipeline.run_content_classification",
        return_value={
            "content_type": "release_notes",
            "confidence": 0.9,
            "explanation": "High confidence classification.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": 0.80,
            "explanation": "Good baseline relevance.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_entity_extraction",
        return_value={
            "mentions": [],
            "candidate_entities": [],
            "primary_entity_id": None,
            "confidence": 0.0,
            "explanation": "Existing mentions are already attached to the content.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_summarization",
        return_value={
            "summary": "A concise summary for the editor.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )

    process_content(_require_pk(pipeline_context.content))

    pipeline_context.content.refresh_from_db()
    assert pipeline_context.content.authority_adjusted_score == pytest.approx(0.872)


def test_process_content_queues_borderline_items_for_review(pipeline_context, mocker):
    mocker.patch(
        "core.pipeline.run_content_classification",
        return_value={
            "content_type": "technical_article",
            "confidence": 0.9,
            "explanation": "High confidence classification.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": 0.55,
            "explanation": "Borderline similarity to the project baseline.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_entity_extraction",
        return_value={
            "mentions": [],
            "candidate_entities": [],
            "primary_entity_id": None,
            "confidence": 0.0,
            "explanation": "No extracted entity mentions.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    summarize_mock = mocker.patch("core.pipeline.run_summarization")

    result = process_content(pipeline_context.content.id)

    pipeline_context.content.refresh_from_db()
    assert result["status"] == "review"
    assert pipeline_context.content.is_active is True
    summarize_mock.assert_not_called()
    review_item = ReviewQueue.objects.get(
        content=pipeline_context.content, reason=ReviewReason.BORDERLINE_RELEVANCE
    )
    assert review_item.confidence == pytest.approx(0.55)


def test_process_content_archives_irrelevant_items(pipeline_context, mocker):
    mocker.patch(
        "core.pipeline.run_content_classification",
        return_value={
            "content_type": "other",
            "confidence": 0.7,
            "explanation": "Low signal classification.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": 0.2,
            "explanation": "Far from the project reference corpus.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_entity_extraction",
        return_value={
            "mentions": [],
            "candidate_entities": [],
            "primary_entity_id": None,
            "confidence": 0.0,
            "explanation": "No extracted entity mentions.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    summarize_mock = mocker.patch("core.pipeline.run_summarization")

    result = process_content(pipeline_context.content.id)

    pipeline_context.content.refresh_from_db()
    assert result["status"] == "archived"
    assert pipeline_context.content.is_active is False
    summarize_mock.assert_not_called()
    assert (
        ReviewQueue.objects.filter(
            content=pipeline_context.content, reason=ReviewReason.BORDERLINE_RELEVANCE
        ).count()
        == 0
    )


def test_process_content_adds_review_item_for_low_confidence_classification(
    pipeline_context, mocker
):
    mocker.patch(
        "core.pipeline.run_content_classification",
        return_value={
            "content_type": "other",
            "confidence": 0.3,
            "explanation": "Ambiguous content.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": 0.9,
            "explanation": "Close to the project baseline.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_entity_extraction",
        return_value={
            "mentions": [],
            "candidate_entities": [],
            "primary_entity_id": None,
            "confidence": 0.0,
            "explanation": "No extracted entity mentions.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_summarization",
        return_value={
            "summary": "Summary present even though classification confidence was low.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )

    result = process_content(pipeline_context.content.id)

    assert result["status"] == "completed"
    review_item = ReviewQueue.objects.get(
        content=pipeline_context.content,
        reason=ReviewReason.LOW_CONFIDENCE_CLASSIFICATION,
    )
    assert review_item.confidence == pytest.approx(0.3)


def test_process_content_marks_exact_duplicates_and_skips_downstream_skills(
    pipeline_context, mocker
):
    existing = Content.objects.create(
        project=pipeline_context.project,
        url="https://example.com/source-story",
        canonical_url=canonicalize_url("https://example.com/source-story"),
        title="Original Story",
        author="Editor",
        source_plugin="rss",
        published_date="2026-04-25T00:00:00Z",
        content_text="Original reporting for the same story.",
    )
    duplicate = Content.objects.create(
        project=pipeline_context.project,
        url="https://example.com/source-story?utm_source=reddit&ref=thread",
        title="Reddit thread about the same story",
        author="Editor",
        source_plugin="reddit",
        published_date="2026-04-26T00:00:00Z",
        content_text="A social post linking back to the same article.",
    )
    classify_mock = mocker.patch("core.pipeline.run_content_classification")
    relevance_mock = mocker.patch("core.pipeline.run_relevance_scoring")
    summarize_mock = mocker.patch("core.pipeline.run_summarization")

    result = process_content(_require_pk(duplicate))

    duplicate.refresh_from_db()
    existing.refresh_from_db()
    assert result["status"] == "duplicate"
    assert duplicate.duplicate_of == existing
    assert duplicate.is_active is False
    assert existing.duplicate_signal_count == 1
    assert classify_mock.call_count == 0
    assert relevance_mock.call_count == 0
    assert summarize_mock.call_count == 0
    assert (
        SkillResult.objects.filter(
            content=duplicate, skill_name=DEDUPLICATION_SKILL_NAME
        ).count()
        == 1
    )


def test_process_content_marks_semantic_duplicates_with_high_similarity(
    pipeline_context, mocker
):
    existing = Content.objects.create(
        project=pipeline_context.project,
        url="https://example.com/existing-semantic-story",
        canonical_url=canonicalize_url("https://example.com/existing-semantic-story"),
        title="Platform teams cut toil with golden paths",
        author="Editor",
        source_plugin="rss",
        published_date="2026-04-25T00:00:00Z",
        content_text="Golden paths and reusable workflows reduce toil for platform teams.",
    )
    candidate = Content.objects.create(
        project=pipeline_context.project,
        url="https://example.com/new-semantic-story",
        title="Golden paths reduce toil for platform orgs",
        author="Editor",
        source_plugin="newsletter",
        published_date="2026-04-26T00:00:00Z",
        content_text="Reusable platform workflows lower cognitive load for engineering teams.",
    )
    mocker.patch(
        "core.pipeline.search_similar_content",
        return_value=[
            SimpleNamespace(score=0.95, payload={"content_id": _require_pk(existing)})
        ],
    )
    classify_mock = mocker.patch("core.pipeline.run_content_classification")

    result = process_content(_require_pk(candidate))

    candidate.refresh_from_db()
    existing.refresh_from_db()
    assert result["status"] == "duplicate"
    assert candidate.duplicate_of == existing
    assert candidate.is_active is False
    assert existing.duplicate_signal_count == 1
    assert classify_mock.call_count == 0


def test_run_deduplication_uses_llm_tiebreak_for_borderline_similarity(
    pipeline_context, settings, mocker
):
    settings.OPENROUTER_API_KEY = "test-key"
    candidate = Content.objects.create(
        project=pipeline_context.project,
        url="https://example.com/candidate-story",
        title="A discussion thread about release policies",
        author="Editor",
        source_plugin="reddit",
        published_date="2026-04-26T00:00:00Z",
        content_text="Community discussion about the same release policy changes.",
    )
    mocker.patch(
        "core.pipeline.search_similar_content",
        return_value=[
            SimpleNamespace(
                score=0.90, payload={"content_id": pipeline_context.content.id}
            )
        ],
    )
    openrouter_mock = mocker.patch(
        "core.pipeline.openrouter_chat_json",
        return_value=SimpleNamespace(
            payload={
                "is_duplicate": True,
                "confidence": 0.94,
                "explanation": "Both items refer to the same underlying release-policy article.",
            },
            model="openrouter/relevance-model",
            latency_ms=66,
        ),
    )

    result = run_deduplication(candidate)

    assert result["is_duplicate"] is True
    assert result["matched_stage"] == "llm"
    assert result["model_used"] == "openrouter/relevance-model"
    assert (
        openrouter_mock.call_args.kwargs["system_prompt"]
        == get_skill_definition(DEDUPLICATION_SKILL_NAME).instructions_markdown
    )


def test_run_content_classification_uses_openrouter_response_and_normalizes_values(
    pipeline_context,
    settings,
    mocker,
):
    settings.OPENROUTER_API_KEY = "test-key"
    mocker.patch(
        "core.pipeline.openrouter_chat_json",
        return_value=SimpleNamespace(
            payload={
                "content_type": "unexpected_type",
                "confidence": "1.7",
                "explanation": "Model decided this was novel.",
            },
            model="openrouter/test-model",
            latency_ms=123,
        ),
    )

    result = run_content_classification(pipeline_context.content)

    assert result == {
        "content_type": "other",
        "confidence": 1.0,
        "explanation": "Model decided this was novel.",
        "model_used": "openrouter/test-model",
        "latency_ms": 123,
    }


def test_run_content_classification_falls_back_to_heuristic_when_openrouter_fails(
    pipeline_context,
    settings,
    mocker,
):
    settings.OPENROUTER_API_KEY = "test-key"
    mocker.patch(
        "core.pipeline.openrouter_chat_json",
        side_effect=RuntimeError("llm unavailable"),
    )

    result = run_content_classification(pipeline_context.content)

    assert result["content_type"] == "technical_article"
    assert result["model_used"] == "heuristic"
    assert result["latency_ms"] == 0


def test_run_relevance_scoring_uses_openrouter_for_borderline_similarity(
    pipeline_context,
    settings,
    mocker,
):
    settings.OPENROUTER_API_KEY = "test-key"
    mocker.patch(
        "core.pipeline.build_content_embedding_text", return_value="embedding text"
    )
    mocker.patch("core.pipeline.embed_text", return_value=[0.1, 0.2, 0.3])
    mocker.patch("core.pipeline.get_reference_similarity", return_value=0.6)
    openrouter_mock = mocker.patch(
        "core.pipeline.openrouter_chat_json",
        return_value=SimpleNamespace(
            payload={
                "relevance_score": "0.74",
                "explanation": "LLM confirmed the borderline match.",
            },
            model="openrouter/relevance-model",
            latency_ms=87,
        ),
    )

    result = run_relevance_scoring(pipeline_context.content)

    assert result == {
        "relevance_score": 0.74,
        "explanation": "LLM confirmed the borderline match.",
        "used_llm": True,
        "model_used": "openrouter/relevance-model",
        "latency_ms": 87,
    }
    openrouter_mock.assert_called_once()


def test_run_relevance_scoring_skips_llm_for_high_similarity(
    pipeline_context,
    settings,
    mocker,
):
    mocker.patch(
        "core.pipeline.build_content_embedding_text", return_value="embedding text"
    )
    mocker.patch("core.pipeline.embed_text", return_value=[0.1, 0.2, 0.3])
    mocker.patch("core.pipeline.get_reference_similarity", return_value=0.95)
    openrouter_mock = mocker.patch("core.pipeline.openrouter_chat_json")

    result = run_relevance_scoring(pipeline_context.content)

    assert result == {
        "relevance_score": 0.95,
        "explanation": "Reference corpus similarity score is 0.95; no LLM adjudication was required.",
        "used_llm": False,
        "model_used": f"embedding:{settings.EMBEDDING_MODEL}",
        "latency_ms": 0,
    }
    openrouter_mock.assert_not_called()


def test_run_relevance_scoring_falls_back_when_openrouter_fails(
    pipeline_context,
    settings,
    mocker,
):
    settings.OPENROUTER_API_KEY = "test-key"
    mocker.patch(
        "core.pipeline.build_content_embedding_text", return_value="embedding text"
    )
    mocker.patch("core.pipeline.embed_text", return_value=[0.1, 0.2, 0.3])
    mocker.patch("core.pipeline.get_reference_similarity", return_value=0.6)
    mocker.patch(
        "core.pipeline.openrouter_chat_json",
        side_effect=RuntimeError("llm unavailable"),
    )

    result = run_relevance_scoring(pipeline_context.content)

    assert result["relevance_score"] == 0.6
    assert result["used_llm"] is False
    assert "Borderline embedding similarity" in result["explanation"]


def test_run_relevance_scoring_prefers_topic_centroid_similarity(
    pipeline_context,
    settings,
    mocker,
):
    mocker.patch(
        "core.pipeline.build_content_embedding_text", return_value="embedding text"
    )
    mocker.patch("core.pipeline.embed_text", return_value=[0.1, 0.2, 0.3])
    mocker.patch("core.pipeline.get_reference_similarity", return_value=0.34)
    mocker.patch("core.pipeline.get_topic_centroid_similarity", return_value=0.91)
    openrouter_mock = mocker.patch("core.pipeline.openrouter_chat_json")

    result = run_relevance_scoring(pipeline_context.content)

    assert result == {
        "relevance_score": 0.91,
        "explanation": "Feedback centroid similarity score is 0.91; no LLM adjudication was required.",
        "used_llm": False,
        "model_used": f"embedding:{settings.EMBEDDING_MODEL}",
        "latency_ms": 0,
    }
    openrouter_mock.assert_not_called()


def test_run_summarization_falls_back_to_heuristic_when_openrouter_fails(
    pipeline_context,
    settings,
    mocker,
):
    settings.OPENROUTER_API_KEY = "test-key"
    mocker.patch(
        "core.pipeline.openrouter_chat_json",
        side_effect=RuntimeError("model unavailable"),
    )

    result = run_summarization(pipeline_context.content)

    assert result["model_used"] == "heuristic"
    assert result["latency_ms"] == 0
    assert result["summary"] == (
        "This article covers a new Kubernetes release and what changed for platform teams."
    )


def test_execute_ad_hoc_classification_supersedes_previous_result_and_updates_review_item(
    pipeline_context,
    mocker,
):
    classification_mock = mocker.patch(
        "core.pipeline.run_content_classification",
        side_effect=[
            {
                "content_type": "other",
                "confidence": 0.3,
                "explanation": "Very ambiguous.",
                "model_used": "heuristic",
                "latency_ms": 0,
            },
            {
                "content_type": "tutorial",
                "confidence": 0.45,
                "explanation": "Still low confidence, but improved.",
                "model_used": "heuristic",
                "latency_ms": 0,
            },
        ],
    )

    first_result = execute_ad_hoc_skill(
        pipeline_context.content, CLASSIFICATION_SKILL_NAME
    )
    second_result = execute_ad_hoc_skill(
        pipeline_context.content, CLASSIFICATION_SKILL_NAME
    )

    first_result.refresh_from_db()
    pipeline_context.content.refresh_from_db()
    review_item = ReviewQueue.objects.get(
        content=pipeline_context.content,
        reason=ReviewReason.LOW_CONFIDENCE_CLASSIFICATION,
        resolved=False,
    )

    assert classification_mock.call_count == 2
    assert first_result.status == SkillStatus.COMPLETED
    assert second_result.status == SkillStatus.COMPLETED
    assert first_result.superseded_by == second_result
    assert pipeline_context.content.content_type == "tutorial"
    assert review_item.confidence == pytest.approx(0.45)
    assert (
        ReviewQueue.objects.filter(
            content=pipeline_context.content,
            reason=ReviewReason.LOW_CONFIDENCE_CLASSIFICATION,
        ).count()
        == 1
    )


def test_execute_ad_hoc_relevance_creates_review_item_for_borderline_scores(
    pipeline_context,
    mocker,
):
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": 0.55,
            "explanation": "Borderline relevance for manual review.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )

    result = execute_ad_hoc_skill(pipeline_context.content, RELEVANCE_SKILL_NAME)

    pipeline_context.content.refresh_from_db()
    review_item = ReviewQueue.objects.get(
        content=pipeline_context.content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        resolved=False,
    )

    assert result.status == SkillStatus.COMPLETED
    assert result.confidence == pytest.approx(0.55)
    assert pipeline_context.content.relevance_score == pytest.approx(0.55)
    assert pipeline_context.content.is_active is True
    assert review_item.confidence == pytest.approx(0.55)


def test_execute_ad_hoc_relevance_uses_adjusted_score_for_routing(
    pipeline_context,
    settings,
    mocker,
):
    pipeline_context.content.entity = Entity.objects.create(
        project=pipeline_context.project,
        name="Authority Anchor",
        type="organization",
        authority_score=1.0,
    )
    pipeline_context.content.save(update_fields=["entity"])
    base_score = min(
        settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD - 0.01,
        settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD / 1.15 + 0.005,
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": base_score,
            "explanation": "Base relevance is borderline until authority is applied.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )

    result = execute_ad_hoc_skill(pipeline_context.content, RELEVANCE_SKILL_NAME)

    pipeline_context.content.refresh_from_db()
    adjusted_score = pipeline_context.content.authority_adjusted_score

    assert result.status == SkillStatus.COMPLETED
    assert pipeline_context.content.relevance_score == pytest.approx(base_score)
    assert adjusted_score is not None
    assert adjusted_score > settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD
    assert result.confidence == pytest.approx(adjusted_score)
    assert result.result_data["relevance_score"] == pytest.approx(base_score)
    assert result.result_data["authority_adjusted_score"] == pytest.approx(
        adjusted_score
    )
    assert result.result_data["final_relevance_score"] == pytest.approx(adjusted_score)
    assert pipeline_context.content.is_active is True
    assert not ReviewQueue.objects.filter(
        content=pipeline_context.content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        resolved=False,
    ).exists()


def test_execute_ad_hoc_summarization_returns_failed_result_when_relevance_is_too_low(
    pipeline_context,
):
    pipeline_context.content.relevance_score = 0.2
    pipeline_context.content.save(update_fields=["relevance_score"])

    result = execute_ad_hoc_skill(pipeline_context.content, SUMMARIZATION_SKILL_NAME)

    assert result.status == SkillStatus.FAILED
    assert "Summarization requires relevance_score" in result.error_message


def test_execute_ad_hoc_summarization_allows_adjusted_score_to_pass_gate(
    pipeline_context,
    settings,
    mocker,
):
    pipeline_context.content.relevance_score = (
        settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD - 0.15
    )
    pipeline_context.content.authority_adjusted_score = (
        settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD + 0.05
    )
    pipeline_context.content.save(
        update_fields=["relevance_score", "authority_adjusted_score"]
    )
    summarization_mock = mocker.patch(
        "core.pipeline.run_summarization",
        return_value={
            "summary": "Authority-adjusted content is now eligible.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )

    result = execute_ad_hoc_skill(pipeline_context.content, SUMMARIZATION_SKILL_NAME)

    pipeline_context.content.refresh_from_db()
    assert result.status == SkillStatus.COMPLETED
    assert (
        pipeline_context.content.summary_text
        == "Authority-adjusted content is now eligible."
    )
    assert result.result_data == {
        "summary": "Authority-adjusted content is now eligible.",
        "model_used": "heuristic",
        "latency_ms": 0,
    }
    summarization_mock.assert_called_once_with(pipeline_context.content)


def test_execute_ad_hoc_related_content_returns_failed_result_on_search_error(
    pipeline_context,
    mocker,
):
    mocker.patch(
        "core.pipeline.search_similar_content",
        side_effect=RuntimeError("vector index unavailable"),
    )

    result = execute_ad_hoc_skill(pipeline_context.content, RELATED_CONTENT_SKILL_NAME)

    assert result.status == SkillStatus.FAILED
    assert result.skill_name == RELATED_CONTENT_SKILL_NAME
    assert result.error_message == "vector index unavailable"


def test_create_pending_skill_result_rejects_non_async_skill(pipeline_context):
    with pytest.raises(ValueError, match="Unsupported async skill name"):
        create_pending_skill_result(pipeline_context.content, CLASSIFICATION_SKILL_NAME)


def test_execute_background_skill_result_rejects_skill_name_mismatch(pipeline_context):
    pending_result = create_pending_skill_result(
        pipeline_context.content, RELEVANCE_SKILL_NAME
    )

    with pytest.raises(ValueError, match="is for relevance_scoring, not summarization"):
        execute_background_skill_result(
            _require_pk(pending_result), SUMMARIZATION_SKILL_NAME
        )


def test_execute_background_skill_result_completes_summary_when_requirements_are_met(
    pipeline_context,
    mocker,
):
    pipeline_context.content.relevance_score = 0.9
    pipeline_context.content.save(update_fields=["relevance_score"])
    pending_result = create_pending_skill_result(
        pipeline_context.content, SUMMARIZATION_SKILL_NAME
    )
    mocker.patch(
        "core.pipeline.run_summarization",
        return_value={
            "summary": "Manual summary output.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )

    result = execute_background_skill_result(
        _require_pk(pending_result), SUMMARIZATION_SKILL_NAME
    )

    pending_result.refresh_from_db()
    pipeline_context.content.refresh_from_db()
    assert result.status == SkillStatus.COMPLETED
    assert pending_result.status == SkillStatus.COMPLETED
    assert pipeline_context.content.summary_text == "Manual summary output."
    assert pending_result.result_data == {
        "summary": "Manual summary output.",
        "model_used": "heuristic",
        "latency_ms": 0,
    }


def test_execute_background_skill_result_uses_adjusted_score_for_relevance_confidence(
    pipeline_context,
    settings,
    mocker,
):
    pipeline_context.content.entity = Entity.objects.create(
        project=pipeline_context.project,
        name="Background Authority Anchor",
        type="organization",
        authority_score=1.0,
    )
    pipeline_context.content.save(update_fields=["entity"])
    base_score = min(
        settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD - 0.01,
        settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD / 1.15 + 0.005,
    )
    pending_result = create_pending_skill_result(
        pipeline_context.content, RELEVANCE_SKILL_NAME
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": base_score,
            "explanation": "Background relevance is borderline until authority is applied.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )

    result = execute_background_skill_result(
        _require_pk(pending_result), RELEVANCE_SKILL_NAME
    )

    pending_result.refresh_from_db()
    pipeline_context.content.refresh_from_db()
    adjusted_score = pipeline_context.content.authority_adjusted_score

    assert result.status == SkillStatus.COMPLETED
    assert pending_result.status == SkillStatus.COMPLETED
    assert pipeline_context.content.relevance_score == pytest.approx(base_score)
    assert adjusted_score is not None
    assert adjusted_score > settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD
    assert pending_result.confidence == pytest.approx(adjusted_score)
    assert pending_result.result_data["relevance_score"] == pytest.approx(base_score)
    assert pending_result.result_data["authority_adjusted_score"] == pytest.approx(
        adjusted_score
    )
    assert pending_result.result_data["final_relevance_score"] == pytest.approx(
        adjusted_score
    )
    assert not ReviewQueue.objects.filter(
        content=pipeline_context.content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        resolved=False,
    ).exists()


def test_execute_background_skill_result_completes_summary_when_adjusted_score_passes_gate(
    pipeline_context,
    settings,
    mocker,
):
    pipeline_context.content.relevance_score = (
        settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD - 0.15
    )
    pipeline_context.content.authority_adjusted_score = (
        settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD + 0.05
    )
    pipeline_context.content.save(
        update_fields=["relevance_score", "authority_adjusted_score"]
    )
    pending_result = create_pending_skill_result(
        pipeline_context.content, SUMMARIZATION_SKILL_NAME
    )
    summarization_mock = mocker.patch(
        "core.pipeline.run_summarization",
        return_value={
            "summary": "Background summary output.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )

    result = execute_background_skill_result(
        _require_pk(pending_result), SUMMARIZATION_SKILL_NAME
    )

    pending_result.refresh_from_db()
    assert result.status == SkillStatus.COMPLETED
    assert pending_result.status == SkillStatus.COMPLETED
    assert pending_result.result_data == {
        "summary": "Background summary output.",
        "model_used": "heuristic",
        "latency_ms": 0,
    }
    summarization_mock.assert_called_once_with(pipeline_context.content)


def test_execute_background_skill_result_marks_relevance_failed_when_execution_errors(
    pipeline_context,
    mocker,
):
    pending_result = create_pending_skill_result(
        pipeline_context.content, RELEVANCE_SKILL_NAME
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        side_effect=RuntimeError("embedding unavailable"),
    )

    result = execute_background_skill_result(
        _require_pk(pending_result), RELEVANCE_SKILL_NAME
    )

    pending_result.refresh_from_db()
    assert result.status == SkillStatus.FAILED
    assert pending_result.status == SkillStatus.FAILED
    assert pending_result.error_message == "embedding unavailable"


def test_route_by_relevance_uses_threshold_boundaries(settings):
    assert (
        route_by_relevance(
            {
                "relevance": {
                    "relevance_score": settings.AI_RELEVANCE_SUMMARIZE_THRESHOLD
                }
            }
        )
        == "relevant"
    )
    assert (
        route_by_relevance(
            {
                "relevance": {
                    "relevance_score": settings.AI_RELEVANCE_REVIEW_THRESHOLD - 0.01
                }
            }
        )
        == "irrelevant"
    )
    assert (
        route_by_relevance(
            {"relevance": {"relevance_score": settings.AI_RELEVANCE_REVIEW_THRESHOLD}}
        )
        == "borderline"
    )


def test_run_ad_hoc_relevance_updates_existing_review_item(pipeline_context, mocker):
    existing = ReviewQueue.objects.create(
        project=pipeline_context.project,
        content=pipeline_context.content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        confidence=0.2,
        resolved=False,
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": 0.58,
            "explanation": "Borderline relevance for manual review.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )

    relevance, relevance_score = _run_ad_hoc_relevance(pipeline_context.content)

    existing.refresh_from_db()
    assert relevance_score == pytest.approx(0.58)
    assert existing.confidence == pytest.approx(0.58)
    assert (
        ReviewQueue.objects.filter(
            content=pipeline_context.content, reason=ReviewReason.BORDERLINE_RELEVANCE
        ).count()
        == 1
    )


def test_retry_review_queue_item_keeps_borderline_item_pending(
    pipeline_context, mocker
):
    review_item = ReviewQueue.objects.create(
        project=pipeline_context.project,
        content=pipeline_context.content,
        reason=ReviewReason.BORDERLINE_RELEVANCE,
        confidence=0.52,
        failed_node="score_relevance",
        resolved=False,
    )
    mocker.patch(
        "core.pipeline._run_ad_hoc_relevance",
        return_value=(
            {
                "relevance_score": 0.58,
                "explanation": "Still borderline after retry.",
                "used_llm": False,
                "model_used": "embedding:test",
                "latency_ms": 0,
            },
            0.58,
        ),
    )
    summarize_mock = mocker.patch("core.pipeline._run_ad_hoc_summarization")

    result = retry_review_queue_item(review_item)

    review_item.refresh_from_db()
    pipeline_context.content.refresh_from_db()
    assert result["status"] == "review"
    assert review_item.resolved is False
    assert review_item.resolution == ""
    assert (
        pipeline_context.content.pipeline_state == ContentPipelineState.AWAITING_REVIEW
    )
    summarize_mock.assert_not_called()


def test_execute_with_retries_retries_until_success(settings):
    attempts = {"count": 0}

    def flaky_call():
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise RuntimeError("temporary")
        return {"ok": True}

    result = _execute_with_retries("relevance_scoring", flaky_call)

    assert result == {"ok": True}
    assert attempts["count"] == 3


def test_execute_with_retries_raises_last_exception(settings):
    def always_fail():
        raise RuntimeError("permanent")

    with pytest.raises(RuntimeError, match="permanent"):
        _execute_with_retries("summarization", always_fail)


def test_pipeline_helper_utilities_cover_serialization_and_summary_edges(
    pipeline_context,
):
    empty_content = Content(
        project=pipeline_context.project,
        url="https://example.com/empty",
        title="Empty Content",
        author="Editor",
        source_plugin="rss",
        published_date="2026-04-26T00:00:00Z",
        content_text="   ",
    )
    long_sentence = "A" * 401 + "."
    long_content = Content(
        project=pipeline_context.project,
        url="https://example.com/long",
        title="Long Content",
        author="Editor",
        source_plugin="rss",
        published_date="2026-04-26T00:00:00Z",
        content_text=f"{long_sentence} Second sentence.",
    )

    assert _serialize_related_match(SimpleNamespace(payload=None)) == {
        "content_id": None,
        "title": None,
        "url": None,
        "published_date": None,
        "source_plugin": None,
        "score": 0.0,
    }
    assert (
        _heuristic_summary(empty_content)
        == "Empty Content: no summary was available from the source content."
    )
    assert _heuristic_summary(long_content).endswith("...")
    assert _normalize_summary("   ", pipeline_context.content) == (
        "Kubernetes Release Notes: summary generation returned no content."
    )
    assert _clamp_score("bad") == 0.0
    assert _clamp_score(2) == 1.0
    assert _clamp_score(-1) == 0.0


def test_run_entity_extraction_persists_mentions_and_candidates(
    pipeline_context, mocker
):
    entity = Entity.objects.create(
        project=pipeline_context.project,
        name="Acme Cloud",
        type="vendor",
        website_url="https://acme.example.com",
    )
    pipeline_context.content.title = "Acme Cloud expands platform team tooling"
    pipeline_context.content.content_text = (
        "Acme Cloud announced a new runtime while River Labs joined the launch."
    )
    pipeline_context.content.save(update_fields=["title", "content_text"])
    mocker.patch(
        "entities.extraction.search_similar_entities_for_content",
        return_value=[
            SimpleNamespace(score=0.91, payload={"entity_id": _require_pk(entity)})
        ],
    )

    result = run_entity_extraction(pipeline_context.content)

    mention = EntityMention.objects.get(content=pipeline_context.content, entity=entity)
    candidate = EntityCandidate.objects.get(
        project=pipeline_context.project,
        name="River Labs",
    )

    assert mention.role == "subject"
    assert mention.span == "Acme Cloud"
    assert result["primary_entity_id"] == _require_pk(entity)
    assert pipeline_context.content.entity == entity
    assert candidate.suggested_type == "vendor"
    assert candidate.occurrence_count == 1


def test_process_content_records_entity_extraction_skill_result(
    pipeline_context, mocker
):
    entity = Entity.objects.create(
        project=pipeline_context.project,
        name="Acme Cloud",
        type="vendor",
    )
    mocker.patch(
        "core.pipeline.run_content_classification",
        return_value={
            "content_type": "technical_article",
            "confidence": 0.92,
            "explanation": "Confident classification.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_entity_extraction",
        return_value={
            "mentions": [
                {
                    "entity_id": _require_pk(entity),
                    "entity_name": entity.name,
                    "role": "subject",
                    "sentiment": "neutral",
                    "span": entity.name,
                    "confidence": 0.88,
                }
            ],
            "candidate_entities": [],
            "primary_entity_id": _require_pk(entity),
            "confidence": 0.88,
            "explanation": "Tracked entity matched in the title.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_relevance_scoring",
        return_value={
            "relevance_score": 0.9,
            "explanation": "Highly relevant.",
            "used_llm": False,
            "model_used": "embedding:test",
            "latency_ms": 0,
        },
    )
    mocker.patch(
        "core.pipeline.run_summarization",
        return_value={
            "summary": "Summary for editors.",
            "model_used": "heuristic",
            "latency_ms": 0,
        },
    )

    result = process_content(pipeline_context.content.id)

    skill_result = SkillResult.objects.get(
        content=pipeline_context.content,
        skill_name=ENTITY_EXTRACTION_SKILL_NAME,
    )

    assert result["status"] == "completed"
    assert skill_result.status == SkillStatus.COMPLETED
    assert skill_result.confidence == pytest.approx(0.88)
    assert skill_result.result_data["mentions"][0]["entity_name"] == entity.name
