---
name: project-api-patterns
description: "Use when adding or changing project-scoped Ninja routes, request or response schemas, nested routes, or API docs in `projects/ninja_api.py` and related app `*_ninja_api.py` modules. Trigger phrases include project API, nested route, schema validation, project_id endpoint, and OpenAPI docs."
---

# Project API Patterns Skill

Use this skill when changing the project-scoped API.

## Rules

- Treat `Project` as the isolation boundary.
- Top-level project resources live on the base router; most other resources are nested under `/api/v1/projects/{project_id}/...`.
- Reuse the existing nested router structure in `projects/ninja_api.py` and the app `*_ninja_api.py` modules for nested resources.
- Enforce cross-project relationship validation explicitly in schema helpers or endpoint-local validation code.
- Keep API field names in `snake_case` to match current backend payloads and frontend types.
- Update Ninja request schemas, response schemas, and OpenAPI metadata in the owning `*_ninja_api.py` module when the endpoint contract changes.

## Implementation Guidance

- Add or update request and response schemas in the owning `*_ninja_api.py` module or nearby helpers when the logic is shared.
- Add or update route handlers and OpenAPI metadata in the owning `*_ninja_api.py` module.
- Register routes through `projects/ninja_api.py` or `digest_engine/ninja_api.py` using the existing nested router pattern.
- If the frontend consumes the API, update `frontend/src/lib/types.ts` and `frontend/src/lib/api.ts`.
- Add or update focused tests near the changed behavior, usually under the owning app's `tests/` package.

## References

- `digest_engine/ninja_api.py`
- `projects/ninja_api.py`
- `frontend/src/lib/types.ts`
- `frontend/src/lib/api.ts`
