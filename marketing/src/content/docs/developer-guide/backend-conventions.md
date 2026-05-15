# Backend Conventions

## Project Scoping Invariants
Because this is a multi-project (not tenant) system, data leakage is the worst possible bug.
* Almost all ViewSets must inherit from `ProjectOwnedQuerysetMixin`.
* URLs are nested: `/api/v1/projects/{project_id}/...`.
* The `project_id` must be explicitly verified when linking related objects via Foreign Key in serializers.

## DRF Patterns
* Keep views and viewsets extremely thin.
* Put operational logic in `core/tasks.py`, `core/pipeline.py`, or application-specific helpers like `newsletters/intake.py`.
* Pass the `project` object via `serializer.context` during creation overrides.

## Code Placement
Do not dump everything into `core/`.
If you are adding functionality for trend clustering, it belongs in `trends/`. If you are adding a new ingestion source, it belongs in `ingestion/`. `core/` is exclusively for plumbing (auth, WSGI, abstract models, LLM wrappers).

## Plugin Interface
All sources must implement the `SourcePlugin` interface, keeping `fetch()` operations standardized whether they connect to RSS, Reddit, or Bluesky.

## Celery Task Conventions
Always pass database IDs (e.g., `content_id`), not serialized ORM objects, as arguments to Celery tasks.

## drf-spectacular Schema Metadata
If you change an API return shape, use `@extend_schema` to update the type hints so the OpenAPI spec remains accurate.

## Docstring Rules
Follow Google-style docstrings with PEP 257 conventions. Add docstrings to modules, public classes, and public functions. Skip obvious one-liners.
