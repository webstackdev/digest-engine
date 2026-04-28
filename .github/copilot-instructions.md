# Newsletter Maker Project Instructions

You are working in Newsletter Maker, a Django + DRF + Celery + Qdrant backend with a Next.js App Router frontend.

## Repository Shape

- Backend runtime code lives in `core/`.
- Django project settings and top-level URLs live in `newsletter_maker/`.
- Backend tests live primarily in `core/tests/` and `tests/`.
- Frontend application code lives in `frontend/src/app/`, shared UI in `frontend/src/components/`, and shared API/types/helpers in `frontend/src/lib/`.
- Operational and architecture docs live in `docs/`.

## Working Norms

- Prefer the smallest correct slice of work. Not every request requires both backend and frontend changes.
- For user-facing product features, assess the full path: model or worker changes, serializer or API changes, frontend types and data access, UI updates, and tests.
- For admin-only, ingestion-only, worker-only, documentation-only, or settings-only changes, stay in the affected layer. Do not scaffold unnecessary frontend code.
- Preserve existing naming. This repo uses `project`, not `tenant`.

## Backend Conventions

- Project scoping is a core invariant. Most API resources are nested under `/api/v1/projects/{project_id}/...`.
- Reuse the established DRF patterns in `core/api.py`, `core/api_urls.py`, and `core/serializers.py`:
	- `ProjectOwnedQuerysetMixin` for nested viewsets
	- serializer context containing `project`
	- explicit validation for cross-project foreign keys
- Keep viewsets and views thin. Put operational logic in `core/tasks.py`, `core/pipeline.py`, `core/newsletters.py`, `core/plugins/`, or nearby helpers.
- Preserve existing API field shapes. Backend serializers and frontend types currently use `snake_case`; do not introduce ad hoc `camelCase` transforms.
- When API behavior changes, update drf-spectacular schema metadata in `core/api.py`.
- When changing ingestion, newsletter intake, AI processing, or embeddings, preserve the handoff between database state, Celery tasks, and Qdrant state.

## Frontend Conventions

- The frontend uses Next.js App Router.
- Shared backend-facing types belong in `frontend/src/lib/types.ts`.
- Shared backend-facing data access belongs in `frontend/src/lib/api.ts` unless there is a clear reason to add a route handler under `frontend/src/app/api/`.
- Keep reusable UI in `frontend/src/components/` and page assembly in `frontend/src/app/`.
- Preserve existing backend payload shapes in TypeScript types and UI code unless the backend contract is intentionally changing.

## Documentation Standards

- Python uses Google-style docstrings with PEP 257 conventions.
- Add or improve module docstrings plus public classes, public functions, and non-obvious helpers.
- Do not add noisy boilerplate to trivial `__str__` methods, simple properties, or obvious one-line helpers unless the surrounding file genuinely benefits.
- TypeScript and React code should use JSDoc for exported utilities, hooks, route handlers, and non-trivial components when behavior is not obvious from the type signature alone.
- If architecture or workflow behavior changes, update the most relevant docs in `docs/`, especially `docs/DEVELOPER_GUIDE.md`, `docs/IMPLEMENTATION_OVERVIEW.md`, `docs/MODELS.md`, `docs/RELEVANCE_SCORING.md`, or `docs/LOGGING.md`.

## Testing And Validation

- Backend tests use `pytest`.
- Frontend tests use `vitest`.
- Prefer focused validation commands over full-suite runs when the change is localized.
- Common commands in this repo:
	- `pytest core/tests/...`
	- `python manage.py check`
	- `just backend-lint`
	- `cd frontend && npm run test:run`
	- `cd frontend && npm run typecheck`
	- `just frontend-lint`
- Prefer existing `just` tasks when they cover the needed validation flow.

## Skill Usage

Use the workspace skills in `.github/skills/` when they match the task:

- `docstring-enforcer`: documentation passes or doc cleanup across multiple files.
- `coverage-auditor`: closing backend or frontend test gaps.
- `bridge-scaffolder`: features that span Django API work and Next.js consumption.
- `project-api-patterns`: adding or changing project-scoped DRF endpoints.
- `source-plugin-patterns`: adding or changing ingestion plugins or source-config behavior.
- `ai-pipeline-patterns`: changing embeddings, relevance scoring, newsletter intake, or Celery-driven AI workflow behavior.
