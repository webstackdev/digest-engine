---
name: "Frontend Component Structure Guidelines"
description: "Use when creating, moving, or refactoring React components, Storybook stories, or frontend tests in frontend/src/. Covers the preferred elements/layout/ui/providers/app _components directory structure and colocated naming conventions."
applyTo:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

# Frontend Component Structure Guidelines

- Avoid growing a flat `frontend/src/components/` directory.
- Put app-owned presentational or interactive components that combine shadcn primitives with project-specific functionality in `frontend/src/components/elements/`.
- Put shared structural components in `frontend/src/components/layout/`.
- Keep `frontend/src/components/ui/` for shadcn components installed directly by `npx shadcn@latest add <component>`.
- Put provider-style wrappers and context composition in `frontend/src/providers/`.
- Put route-local components in `frontend/src/app/**/_components/` when they are only used by a single route.
- Put route page tests beside the page or route-local component they cover within the same `frontend/src/app/**` directory.
- For app-owned folders under `frontend/src/components/elements/`, `frontend/src/components/layout/`, `frontend/src/providers/`, and `frontend/src/app/**/_components/`, let the folder name carry the component or provider name and use `index.tsx`, `index.test.tsx`, and `index.stories.tsx` for colocated files.
- Do not add barrel `index.ts` files inside those component or provider folders unless a task explicitly needs a separate module boundary.
- Preserve shadcn's generated file naming and structure inside `frontend/src/components/ui/`; do not wrap those generated components in extra folders just to match the app-owned component pattern.
- For new Storybook stories that use `tags: ["autodocs"]`, set `parameters.docs` to the shared compact docs helper in `frontend/src/lib/storybook-docs.tsx` so the Docs tab omits the default `Stories` block and uses the reduced primary canvas height.

## Preferred Shapes

Shared reusable component:

```text
frontend/src/components/elements/StatusBadge/
  index.tsx
  index.stories.tsx
  index.test.tsx
```

Shadcn-installed primitive:

```text
frontend/src/components/ui/button.tsx
```

Shared provider:

```text
frontend/src/providers/ThemeProvider/
  index.tsx
  index.test.tsx
```

Route-local component:

```text
frontend/src/app/projects/[id]/_components/MemberInviteCard/
  index.tsx
  index.stories.tsx
  index.test.tsx
```

Route page with colocated test:

```text
frontend/src/app/admin/sources/
  page.tsx
  page.test.tsx
```

## Placement Heuristics

- If the component is a shadcn primitive created by the CLI, keep it under `components/ui/` with the generated naming.
- If the component is app-owned and composes shadcn primitives with project-specific behavior or presentation, place it under `components/elements/`.
- If the component primarily arranges shared navigation or page chrome, place it under `components/layout/`.
- If the module primarily provides context or wraps app trees with provider logic, place it under `providers/`.
- If the component is only consumed by one route segment, keep it under that route's `_components/` folder instead of promoting it to `components/`.
- Prefer folder-level naming over duplicate file naming. For example, prefer `OriginalContentIdeaCard/index.tsx` over `OriginalContentIdeaCard/OriginalContentIdeaCard.tsx`.
- When extracting from a large page, prefer moving the smallest reusable visual leaves first, then larger feature sections, while keeping the page as the orchestration layer.
- Prefer `*.test.tsx` files beside the owning page or component over `__tests__/` directories for new frontend tests.

## Notes

- Preserve the existing backend contract and keep frontend payloads in `snake_case`.
- Follow the repo's colocated story convention for Storybook.
- Reuse `frontend/src/lib/storybook-docs.tsx` for compact Docs tabs in new stories instead of re-declaring the same docs page JSX in each file.
- Do not move files only to satisfy the structure guideline unless the current task already touches that area.
