# Frontend Conventions

## App Router Layout
* `app/`: Next.js page components, layouts, and route handlers.
* `components/`: UI pieces, divided into:
  * `elements/`: App-owned smart components that combine primitives with project logic.
  * `layout/`: Shared navigation and page chrome.
  * `ui/`: Raw `shadcn/ui` installed components. **Do not modify these unless absolutely necessary.**
* `providers/`: Context wrappers (theme, query client).
* `lib/`: API fetchers, types, and hooks.

## Components Structure
For components in `elements/` or `layout/`:
Let the folder carry the name, e.g., `components/elements/UserAvatar/`.
Inside, use:
* `index.tsx`
* `index.test.tsx`
* `index.stories.tsx`
**Do not use barrel `index.ts` files** to simply re-export unless architecturally required.

## Shared Types and API
* Shared backend-facing types live in `frontend/src/lib/types.ts`.
* Data requests live in `frontend/src/lib/api.ts`.
* **Preserve `snake_case`**: Do not arbitrarily convert the backend's `snake_case` properties into `camelCase` on the frontend. Consume them as they arrive to keep grepping simple.

## Test-with-the-Change Rule
When you add a route, component, or helper, you must write or update the colocated `.test.tsx` Vitest file in the same PR.
