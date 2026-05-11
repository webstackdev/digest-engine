# Digest Engine Documentation

Digest Engine is an AI-powered platform for ingesting, scoring, and writing domain-specific newsletters. It uses LangGraph to orchestrate Claude Skills against incoming RSS, Reddit, and forwarded email content to synthesize high-quality reading lists.

These documents are organized by audience.

* **I am an Editor or Curator using the product day-to-day**: Head to the [User Guide](user-guide/getting-started-saas.md) to learn how to ingest content, manage authority, and synthesize drafts.
* **I am an Administrator installing or managing the platform**: Head to the [Admin Guide](admin-guide/overview.md) to understand Docker deployments, API keys, and queue troubleshooting.
* **I am a Developer contributing code to this repository**: Head to the [Developer Guide](developer-guide/overview.md) to understand local workflows, architecture, and coding conventions.
* **I need to understand the underlying Math and Logic**: Head to the [Reference Section](reference/data-model.md) to see how LangGraph, LangChain, Celery, Qdrant, and the Cosine similarity algorithms are wired together.

## Terminology Note
In this repository, a distinct newsletter workspace is called a **Project** (not a Tenant, not a Workspace). An article or extracted text is called **Content**.
See the full [Glossary](reference/glossary.md) for clarification on Entities, Skills, and Velocity.
