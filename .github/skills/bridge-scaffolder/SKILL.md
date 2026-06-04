---
name: bridge-scaffolder
description: "Use when creating or changing a feature that spans both the Django API and the Next.js frontend. Trigger phrases include full-stack feature, add endpoint and UI, wire frontend to backend, project dashboard change, and bridge backend schemas to frontend types."
---

# Bridge Scaffolder Skill

Use this skill when a change genuinely crosses the backend and frontend boundary.

## Rules

- **Django Side:** Follow the existing patterns in `projects/ninja_api.py` and the app `*_ninja_api.py` modules.
- Most nested resources should stay project-scoped under `/api/v1/projects/{project_id}/...`.
- Keep business logic out of route handlers. Use `core/tasks.py`, `core/pipeline.py`, `core/newsletters.py`, `core/plugins/`, or nearby helpers for real workflow logic.
- **Next.js Side:** Update `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`, and the relevant pages, components, or route handlers under `frontend/src/app/`.
- Preserve the existing `snake_case` payload shape unless the backend contract is intentionally changing.

## Implementation Guidance

- Check `digest_engine/ninja_api.py`, `projects/ninja_api.py`, and the relevant app `*_ninja_api.py` files for the current route topology and schema patterns.
- Keep schema validation aligned with project scoping and cross-project relationship rules.
- If the frontend consumes the new field or endpoint, reflect it in `frontend/src/lib/types.ts` and the corresponding API helpers.
- Update docs when the feature changes a core workflow or user-facing behavior.

## Related Guidance

- Use `project-api-patterns` when the backend portion is primarily a new or changed project-scoped API resource.
- Use `coverage-auditor` immediately after scaffolding to add targeted backend and frontend tests.
