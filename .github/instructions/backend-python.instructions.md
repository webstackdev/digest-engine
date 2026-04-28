---
name: "Backend Python Guidelines"
description: "Use when editing Django, DRF, Celery, plugin, management command, or backend test code in Python. Covers project scoping, workflow placement, docstrings, and focused validation for core/, newsletter_maker/, tests/, and manage.py."
applyTo:
  - "core/**/*.py"
  - "newsletter_maker/**/*.py"
  - "tests/**/*.py"
  - "manage.py"
---

# Backend Python Guidelines

- Preserve `project` as the scoping boundary. Do not reintroduce `tenant` naming.
- Keep Django views and DRF viewsets thin. Put operational logic in nearby helpers such as `core/tasks.py`, `core/pipeline.py`, `core/newsletters.py`, `core/plugins/`, or focused modules next to the owning workflow.
- For nested API resources, follow the patterns in `core/api.py`, `core/api_urls.py`, and `core/serializers.py`.
- Enforce cross-project relationship validation in serializers instead of trusting the client.
- Preserve existing API field names in `snake_case` unless the contract is intentionally changing across backend and frontend.
- Use Google-style docstrings with PEP 257 conventions for public modules, classes, functions, and non-obvious helpers.
- Keep changes small and local. Do not create generic `services.py` or `utils.py` files unless the repo already needs that extraction.
- When changing ingestion, embeddings, newsletter intake, or review behavior, keep the database, Celery, and Qdrant handoff coherent.

## Validation

- Prefer focused checks first:
  - `pytest core/tests/...`
  - `python manage.py check`
  - `just backend-lint`
- Mock external systems such as Reddit, feed parsing, OpenRouter, email providers, and Qdrant in tests.

## Good Anchors

- `core/models.py`
- `core/serializers.py`
- `core/api.py`
- `core/tasks.py`
- `core/pipeline.py`
- `core/newsletters.py`