# Pipeline

This document details the LangGraph orchestration of the system's core capabilities.

## Entry Points
The pipeline is invoked after basic ingestion has successfully persisted a new `Content` item.
* **Per-content invocation**: Typically called by a Celery task right after a plugin (RSS, Reddit) saves an item.
* **Batch invocation**: Run nightly or hourly to generate aggregate assets (Theme suggestions, trend velocity).

## Node Order
When a `Content` item enters LangGraph, it passes through several state nodes:
1. **Classification**: Categorize the content (News, Tutorial, Opinion, etc.).
2. **Relevance**: Calculate Cosine Similarity. If ambiguous, trigger Relevance Skill. 
3. **Deduplication**: Suppress if $L_2$ distance to already-saved items is extremely tight.
4. **Entity Extraction**: Detect Candidate Entities (people, orgs) referenced in the text.
5. **Summarization**: Generate the 2-3 sentence `summary_text` exposed in the UI.

In a separate batch phase:
6. **Theme Detection & Trend Clustering**: Evaluates recent content to draft newsletter sections.

## Retries & Partial Failure
Our pipeline is designed for **Resilience**:
* If an LLM skill node fails (e.g., timeout, context limit, 429), the node records a `SkillResult` with a failure status.
* The pipeline gracefully degrades. For example, if Relevance fails, it falls back to the baseline Cosine score. If Categorization fails, it is marked `Undefined`. 
* "Stuck" items are enqueued to a `ReviewQueue` or can be re-run via Celery.

## Where Prompts Live
The raw LLM system prompts and logic for each step do not live in the pipeline file itself. They are organized independently. See [Skills](skills.md) and look at the directories under `skills/<skill_name>/SKILL.md`.

## Scheduled vs On-Demand
- **On-Demand**: Categorization, Relevance, Summarization, Deduplication (runs immediately upon content fetch).
- **Scheduled**: Authority Scoring calculation, Trend Velocity compilation, Diversity analysis.
