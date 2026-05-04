# Admin Overview

Welcome to the operator's manual for Newsletter Maker. This guide is assuming you are running the system, not writing code for it.

## Component Map
* **Django (API & Workers)**: Python core running the REST API.
* **Celery Worker**: Asynchronous task runner for LangGraph skills and entity extraction.
* **Celery Beat**: Cron scheduler for trend gathering and fetching RSS/Reddit plugins.
* **PostgreSQL**: Holds all standard application state and configuration.
* **Redis**: Acts as the message broker for Celery and the WebSockets channel layer.
* **Qdrant**: The Vector Database storing the high-dimensional embeddings for Cosine relevance calculations.
* **Ollama** (Optional): A containerized local LLM server for generating embeddings locally without paying OpenAI/OpenRouter.
* **Nginx**: Reverse proxy to route `/api/` traffic to Django and `/` traffic to Next.js.
* **Next.js**: The frontend App Router.

## Request Path
Browser -> Nginx -> Next.js (for HTML) -> Nginx -> Django Gunicorn -> Postgres.

## Ingestion Path
Beat triggers fetch -> Celery Worker -> Fetches RSS array -> Django DB -> Triggers Embedding -> Saves to Qdrant -> Enqueues LangGraph Pipeline -> Celery Worker Executes Skills.

## AI Pipeline Path
Orchestrated by LangGraph inside a Celery task. Calls out to the specific `OPENROUTER_API_BASE` or Local Ollama instance. State transitions are saved continuously to Postgres mapping to `SkillResult`s.

## Realtime Path
Browser -> Nginx (WebSocket Upgrade) -> Django Daphne ASGI -> Redis `CHANNEL_LAYER` -> Broadcast to users.
