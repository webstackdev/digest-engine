---
name: "Frontend Component Structure Guidelines"
description: "Use when creating, moving, or refactoring React components, Storybook stories, or frontend tests in frontend/src/. Covers the preferred ui/layout/features/app _components directory structure and colocating each shared component in its own folder."
applyTo:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

# Frontend Component Structure Guidelines

- Avoid growing a flat `frontend/src/components/` directory.
- Put low-level, generic building blocks in `frontend/src/components/ui/`.
- Put shared structural components in `frontend/src/components/layout/`.
- Put domain-specific reusable components in `frontend/src/components/features/`.
- Put route-local components in `frontend/src/app/**/_components/` when they are only used by a single route.
- Put route page tests beside the page or route-local component they cover within the same `frontend/src/app/**` directory.
- When a component lives under `frontend/src/components/`, give it its own folder instead of a single loose file.
- Colocate the component implementation, Storybook story, tests, and a small `index.ts` export in that folder when those files exist.

## Preferred Shapes

Shared reusable component:

```text
frontend/src/components/ui/Button/
  Button.tsx
  Button.stories.tsx
  Button.test.tsx
  index.ts
```

Route-local component:

```text
frontend/src/app/projects/[id]/_components/MemberInviteCard/
  MemberInviteCard.tsx
  MemberInviteCard.stories.tsx
  MemberInviteCard.test.tsx
  index.ts
```

Route page with colocated test:

```text
frontend/src/app/admin/sources/
  page.tsx
  page.test.tsx
```

## Placement Heuristics

- If the component has no business logic and could be reused across domains, place it under `components/ui/`.
- If the component primarily arranges shared navigation or page chrome, place it under `components/layout/`.
- If the component is tied to a business area but reused across multiple routes, place it under `components/features/<feature-name>/`.
- If the component is only consumed by one route segment, keep it under that route's `_components/` folder instead of promoting it to `components/`.
- When extracting from a large page, prefer moving the smallest reusable visual leaves first, then larger feature sections, while keeping the page as the orchestration layer.
- Prefer `*.test.tsx` files beside the owning page or component over `__tests__/` directories for new frontend tests.

## Notes

- Preserve the existing backend contract and keep frontend payloads in `snake_case`.
- Follow the repo's colocated story convention for Storybook.
- Do not move files only to satisfy the structure guideline unless the current task already touches that area.
