# Developer Overview

Welcome to the Digest Engine codebase! This folder documents how developers build, test, and run the backend and frontend.

## Repo Map

```
digest-engine/
├── core/             # Cross-cutting plumbing (LLM wrappers, Qdrant, auth, tasks)
├── content/          # Content models, deduplication, relevance saving
├── entities/         # Entity extraction, authority scoring
├── frontend/         # Next.js App Router application
├── ingestion/        # RSS, Reddit, Bluesky, Mastodon integrations
├── digest_engine/ # Primary Django Config / WSGI / ASGI routing
├── newsletters/      # Email intake via Anymail, confirmation loops
├── pipeline/         # LangGraph orchestration, Review queues
├── projects/         # Core isolated tenancy setup, global Config models
├── trends/           # Velocity clustering, Theme and Idea suggestion logic
├── users/            # Custom User model and invitations
├── docs/             # Documentation
└── skills/           # Independent Markdown prompts used by LLM Wrapper
```

## Tech Stack
* **Backend**: Python 3.12, Django 5+, Django REST Framework, Celery, Django Channels (WebSockets)
* **Frontend**: React 19, Next.js 15 App Router, TypeScript, TailwindCSS, shadcn/ui, TanStack Query
* **Infrastructure**: Postgres, Redis, Qdrant (Vector DB), Ollama (Local AI)

## Where Apps Live
Unlike monolithic Django applications where `core` is a kitchen sink, this project is modularized by feature. `newsletters.intake` strictly handles ingest; `trends.clustering` handles algorithms for velocities. Only truly global plumbing (like Drf mixins) lives in `core`.

## How to Read This Doc Set
If you are standing up the codebase for the first time, head to [Local Development](local-development.md).
If you're investigating a pipeline failure, head to `docs/reference/pipeline.md`.
If you are writing the Next.js UI, head to [Frontend Conventions](frontend-conventions.md).
