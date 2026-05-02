---
name: "Frontend App Router Guidelines"
description: "Use when editing Next.js App Router pages, route handlers, shared frontend API helpers, or TypeScript UI code in frontend/src/. Covers file placement, backend contract preservation, typing, and frontend validation."
applyTo:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

# Frontend App Router Guidelines

- This frontend uses Next.js App Router, not the Pages Router.
- Keep backend-facing types in `frontend/src/lib/types.ts` and shared server-side API access in `frontend/src/lib/api.ts` unless a route handler in `frontend/src/app/api/` is the correct boundary.
- Reuse the existing backend contract. This repo currently consumes `snake_case` fields from Django; do not silently rename payload keys in the frontend.
- Keep reusable components in `frontend/src/components/`, provider-style wrappers in `frontend/src/providers/`, and page composition in `frontend/src/app/`.
- Keep Vitest files beside the route page, route-local component, or shared component they exercise instead of creating separate `__tests__/` folders.
- Add or update a colocated `*.test.ts` or `*.test.tsx` file in the same change when introducing or modifying a route handler, page, or component. If the file is only a framework passthrough, document why dedicated coverage is omitted.
- Prefer strong explicit types over loose `Record<string, unknown>` shapes when the contract is known.
- Add JSDoc for exported utilities, route handlers, hooks, and non-trivial components when behavior is not obvious from the signature.
- For React components, providers, and App Router pages, keep the component JSDoc to a short summary paragraph and put prop descriptions on the props type or interface fields. Avoid `@param` and `@returns` tags on React components because Storybook Autodocs flattens them into a single block.
- When a change depends on new backend fields or endpoints, update the corresponding types and API helpers in the same change.

## Validation

- Prefer focused checks first:
  - `cd frontend && npm run test:run`
  - `cd frontend && npm run typecheck`
  - `just frontend-lint`

## Good Anchors

- `frontend/src/lib/types.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/app/`
- `frontend/src/components/`
- `frontend/src/providers/`
