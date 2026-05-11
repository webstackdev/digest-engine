# Tunables

This document collects all parameters, thresholds, and variables that change how the system behaves. Most global tunables are configured via environment variables and loaded into Django settings, while project-specific algorithms use `ProjectConfig`.

## How Settings Are Read

1. Environment variables set at the Docker Compose / Kubernetes pod level.
2. Loaded in `digest_engine/settings/base.py` and combined with defaults.
3. Consumed via `django.conf.settings` across the project.

## LLM & Embeddings

These map directly to global inference capability.

* `EMBEDDING_PROVIDER`: Options include `local` (HuggingFace `sentence-transformers`), `ollama`, or `openai`/`openrouter`.
* `EMBEDDING_MODEL`: The identifier for the dense vector model.
* `OLLAMA_URL`: Local instance of Ollama, defaulting to `http://ollama:11434`.
* `OPENROUTER_API_KEY`: Fallback or primary inference provider key for OpenRouter or OpenAI compatible APIs.
* `OPENROUTER_API_BASE`: Endpoint for inference.

## Relevance & Scoring Thresholds

Relevance rules divide candidate articles into clear-match, ambiguous, and clear-non-match bands. See [Algorithms](algorithms.md) for how the pipeline evaluates these.

* **Similarity Thresholds**: Embedding cosine similarity above `0.85` assumes auto-relevant. Below `0.5` assumes irrelevant. The `0.5 - 0.85` band asks the LLM.

## Deduplication Thresholds

* Usually implemented via nearest-neighbor distance (e.g., threshold `< 0.05` means near duplication).

## Authority Weights

Configured per-project in `ProjectConfig`:

* `authority_decay_rate` (default: 0.95): The rate at which an entity's authority metric decays over time without recent mentions.

## Topic Centroid

Configured per-project in `ProjectConfig`:

* `recompute_topic_centroid_on_feedback_save` (default: True): Determines if a user's thumbs up/down immediately recomputes the vector centroid representing the project's topic.

## URL Settings

* `NEWSLETTER_API_INTERNAL_URL`: Internal frontend-to-backend base URL used by the Next.js app for API and WebSocket traffic. In Docker Compose this is usually `http://nginx`.
* `NEWSLETTER_PUBLIC_URL`: Public backend base URL used when Django builds absolute links for emails and OAuth callbacks.
* `NEWSLETTER_API_BASE_URL`: Deprecated compatibility fallback. If present, it is used as the default for both explicit URL settings until those are configured separately.
* `FRONTEND_BASE_URL`: Where the Next.js app sits.

## Observability Retention

Keeps the database from ballooning over time.

* `OBSERVABILITY_SNAPSHOT_RETENTION_DAYS` (default: 90)
* `OBSERVABILITY_TREND_TASK_RUN_RETENTION_DAYS` (default: 30)
* `OBSERVABILITY_REVIEW_QUEUE_RETENTION_DAYS` (default: 30)

## OAuth Provider Toggles

Requires specific API keys to be populated to become available:

* **LinkedIn**: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_OAUTH_SCOPES`
* **Reddit**: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`

## Channels / Messaging

* `CHANNEL_LAYER_URL`: URL to the Redis instance used by Django Channels for ASGI web socket propagation (e.g., `redis://redis:6379/1`).
* `MESSAGING_ENABLED` (frontend/build feature flags).
