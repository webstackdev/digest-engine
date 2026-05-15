---
name: "Frontend App Router Guidelines"
description: "Use when editing Next.js App Router pages, route handlers, shared frontend API helpers, or TypeScript UI code in frontend/src/ or marketing/src/. Covers file placement, backend contract preservation, typing, Tailwind token usage, and frontend validation."
applyTo:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
  - "marketing/src/**/*.ts"
  - "marketing/src/**/*.tsx"
---

# Frontend App Router Guidelines

- This frontend uses Next.js App Router, not the Pages Router.
- Keep backend-facing types in `frontend/src/lib/types.ts` and shared server-side API access in `frontend/src/lib/api.ts` unless a route handler in `frontend/src/app/api/` is the correct boundary.
- Reuse the existing backend contract. This repo currently consumes `snake_case` fields from Django; do not silently rename payload keys in the frontend.
- Keep reusable components in `frontend/src/components/`, provider-style wrappers in `frontend/src/providers/`, and page composition in `frontend/src/app/`.
- Use `lucide-react` for icons in both `frontend` and `marketing` unless the task requires a non-Lucene brand logo, product illustration, or another explicit exception.
- Use Tailwind's built-in size utilities for text size, radius, width and max-width, spacing, tracking, aspect ratio, and line-height. Do not introduce or keep custom size alias classes such as `text-2xs`, `text-button`, `rounded-panel`, `rounded-display`, `tracking-overline`, `max-w-marketing`, or `min-h-half-screen`.
- Do not use text sizes smaller than `text-xs`; if an old alias maps below `0.75rem`, replace it with `text-xs`.
- Prefer semantic Tailwind theme utility classes such as `bg-background`, `bg-page-base`, `bg-primary`, `text-content-active`, `text-content-offset`, `text-primary-foreground`, or `border-trim-offset` when the color should change with the active light or dark theme.
- Use fixed palette utility classes such as `bg-blue-50`, `text-emerald-500`, or `border-amber-400` only when the value should stay fixed across theme changes, such as data visualization, status legends, or decorative washes.
- Do not use direct CSS-variable utility syntax such as `text-[var(--color-primary)]`, `bg-(--theme-color-primary)`, `border-(--brand-border-bright)`, `text-(--font-primary)`, `rounded-[1.65rem]`, or `tracking-[0.24em]` when an existing utility class fits the need.
- Do not use slash-opacity color utilities such as `bg-primary/50`, `border-trim-offset/10`, `text-content-active/80`, or `ring-ring/40`; choose the closest existing semantic or fixed palette class instead.
- Do not add new aliases in `packages/tailwind-config/theme.css` or new theme variables just to create a JSX-friendly Tailwind class. Ask the user before introducing new theme variables.
- Apply Tailwind utility classes directly on the JSX or HTML element that owns the styling. Do not add semantic helper selectors in shared CSS for combinations Tailwind can already express. Keep CSS selectors only when utilities cannot represent the behavior cleanly, such as global element rules, third-party overrides, vendor pseudos, or keyframe definitions.
- Keep Vitest files beside the route page, route-local component, or shared component they exercise instead of creating separate `__tests__/` folders.
- Add or update a colocated `*.test.ts` or `*.test.tsx` file in the same change when introducing or modifying a route handler, page, or component. If the file is only a framework passthrough, document why dedicated coverage is omitted.
- Do not assert Tailwind or other presentational style classes in tests just to verify visual styling. Prefer behavior, accessible output, text, attributes, and state.
- Class assertions are acceptable only when the class itself carries semantic or functional meaning, such as `hidden`, stateful visibility, or another class-based contract consumed by behavior rather than presentation.
- Do not assert spacing, sizing, positioning, color, typography, radius, or shadow classes in tests. Avoid checks for classes such as `px-4`, `gap-4`, `top-4`, `inset-x-4`, `rounded-full`, or `shadow-card-strong` unless the class is part of a functional contract.
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
