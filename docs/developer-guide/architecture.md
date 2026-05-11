# Architecture

This document maps the flow of data and requests through the Digest Engine platform.

## Sync Request Path
Standard API requests (e.g., fetching content, editing entity thresholds) follow a standard synchronous Django flow:
1. **Nginx** terminates SSL and proxies the request to the Gunicorn WSGI worker.
2. **Django & DRF** authenticate the request (session or token).
3. The ViewSet enforces project scoping via `ProjectOwnedQuerysetMixin`.
4. State is read/written to **PostgreSQL**.

## Async Path
Real-time features, like the messaging drawer, use WebSockets:
1. **Nginx** upgrades the connection and routes to Daphne (ASGI).
2. **Django Channels** accepts the WebSocket.
3. Broadcasts and channel layers are coordinated via **Redis**.

## Ingestion Path
How articles enter the system:
1. **Celery Beat** runs scheduled cron jobs (e.g., `core.tasks.fetch_rss`).
2. The task queries `SourceConfig` and invokes the matching `SourcePlugin` (e.g., `RssPlugin`).
3. Raw items are parsed. Novel items are passed to the `embeddings` module.
4. Text is passed to the configured embedding provider (`local`, `ollama`, or `openai`).
5. The `Content` record is saved to Postgres, and the Vector is pushed to **Qdrant**.
6. The item is queued into the LangGraph pipeline.

## LangGraph Orchestration Overview
The AI Pipeline is managed as a State Graph (see [Pipeline](../reference/pipeline.md)). A Celery worker processes each node. If an LLM call fails, the node emits an error state, and the graph gracefully terminates or routes the item to a `ReviewQueue`.

## Frontend Rendering & Data Fetching
* The Next.js 15 App Router utilizes both Server Components (for initial page loads) and Client Components.
* **TanStack React Query** manages client-side data fetching and caching against the Django DRF endpoints.
