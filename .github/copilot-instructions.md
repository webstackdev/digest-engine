# Digest Engine Project Instructions

You are working in Digest Engine, a Django + DRF + Celery + Qdrant backend with a Next.js App Router frontend.

## Repository Shape

- Backend runtime code is split across `core/`, `projects/`, `content/`, `entities/`, `ingestion/`, `newsletters/`, `pipeline/`, `trends/`, and `users/`.
- Django project settings and top-level URLs live in `digest_engine/`.
- Backend tests live in app-local `tests/` packages first (`users/tests/`, `projects/tests/`, `ingestion/tests/`, `newsletters/tests/`, `pipeline/tests/`), with `core/tests/` reserved for the remaining cross-cutting coverage.
- The repo-root `tests/` package is for integration coverage only. New unit and app-scoped tests should live in the owning app's `tests/` package.
- Frontend application code lives in `frontend/src/app/`, shared UI in `frontend/src/components/`, and shared API/types/helpers in `frontend/src/lib/`.
- Operational and architecture docs live in `docs/`.

## Working Norms

- Prefer the smallest correct slice of work. Not every request requires both backend and frontend changes.
- For user-facing product features, assess the full path: model or worker changes, serializer or API changes, frontend types and data access, UI updates, and tests.
- For admin-only, ingestion-only, worker-only, documentation-only, or settings-only changes, stay in the affected layer. Do not scaffold unnecessary frontend code.
- Preserve existing naming. This repo uses `project`, not `tenant`.

## Backend Conventions

- Project scoping is a core invariant. Most API resources are nested under `/api/v1/projects/{project_id}/...`.
- Treat `core/` as the home for genuine cross-cutting concerns only. New app-owned runtime logic should live with its owning app rather than expanding `core/`.
- Reuse the established DRF patterns in `core/api.py`, `core/api_urls.py`, and `core/serializer_mixins.py`:
	- `ProjectOwnedQuerysetMixin` for nested viewsets
	- serializer context containing `project`
	- explicit validation for cross-project foreign keys
- Keep viewsets and views thin. Put operational logic in `core/tasks.py`, `core/pipeline.py`, `ingestion/plugins/`, `newsletters/intake.py`, or nearby helpers owned by the feature's app.
- Preserve existing API field shapes. Backend serializers and frontend types currently use `snake_case`; do not introduce ad hoc `camelCase` transforms.
- When API behavior changes, update drf-spectacular schema metadata in `core/api.py`.
- When changing ingestion, newsletter intake, AI processing, or embeddings, preserve the handoff between database state, Celery tasks, and Qdrant state.

## Frontend Conventions

- The frontend uses Next.js App Router.
- Shared backend-facing types belong in `frontend/src/lib/types.ts`.
- Shared backend-facing data access belongs in `frontend/src/lib/api.ts` unless there is a clear reason to add a route handler under `frontend/src/app/api/`.
- Keep reusable components in `frontend/src/components/`, provider-style wrappers in `frontend/src/providers/`, and page assembly in `frontend/src/app/`.
- Use `frontend/src/components/elements/` for app-owned components that combine shadcn primitives with project-specific functionality.
- Use `frontend/src/components/layout/` for shared navigation, page chrome, and structural layout components.
- Use `frontend/src/components/ui/` only for shadcn components installed by `npx shadcn@latest add <component>`; do not move custom app components into that folder.
- Use `frontend/src/providers/` for provider-style wrappers and context composition such as theme or query providers.
- For component folders under `frontend/src/components/elements/`, `frontend/src/components/layout/`, `frontend/src/providers/`, or `frontend/src/app/**/_components/`, let the folder carry the component name and use `index.tsx`, `index.test.tsx`, and `index.stories.tsx` inside that folder instead of repeating the component name in each file.
- Do not add barrel `index.ts` files inside those component or provider folders unless the task explicitly requires one.
- Frontend tests should live beside the files they cover in `frontend/src/app/` and `frontend/src/components/` rather than in separate `__tests__/` folders.
- When adding or changing a frontend route, page, or component, add or update direct colocated Vitest coverage in the same change. If a file is a pure framework re-export or adapter and a dedicated test is intentionally skipped, call that out explicitly.
- Preserve existing backend payload shapes in TypeScript types and UI code unless the backend contract is intentionally changing.

## Documentation Standards

- Python uses Google-style docstrings with PEP 257 conventions.
- Add or improve module docstrings plus public classes, public functions, and non-obvious helpers.
- Do not add noisy boilerplate to trivial `__str__` methods, simple properties, or obvious one-line helpers unless the surrounding file genuinely benefits.
- TypeScript and React code should use JSDoc for exported utilities, hooks, route handlers, and non-trivial components when behavior is not obvious from the type signature alone.
- For React components, providers, and App Router pages, keep the component JSDoc to a short summary paragraph and document prop fields on the props type or interface. Avoid `@param` and `@returns` tags on React components because Storybook Autodocs flattens them poorly.
- If architecture or workflow behavior changes, update the most relevant docs in `docs/`, especially `docs/DEVELOPER_GUIDE.md`, `docs/IMPLEMENTATION_OVERVIEW.md`, `docs/MODELS.md`, `docs/RELEVANCE_SCORING.md`, or `docs/LOGGING.md`.

## Prompt Skill Conventions

- Application prompt skills live under `skills/<skill_name>/SKILL.md` and are loaded by `core/llm.py` using the folder name rather than the frontmatter `name`.
- When adding or editing one of these prompt skills, always include a short frontmatter `description` so VS Code does not report incomplete skill metadata.
- If a frontmatter `name` is present, prefer lowercase letters, numbers, and hyphens there to satisfy the Copilot markdown validator, even when the runtime skill key elsewhere in the app still uses underscores.

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
