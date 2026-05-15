# Testing

## pytest Layout (Backend)
* Application-specific tests live inside their respective apps (e.g., `users/tests/`, `pipeline/tests/`).
* The top-level `tests/` directory is reserved strictly for full-system integration tests.
* Ensure you are running under the host-side track (SQLite `memory:`) for speed. Example: `just backend-test`.

## Vitest Layout (Frontend)
* Tests live immediately beside the files they test (e.g., `index.test.tsx`).
* We do not use separate `__tests__/` folders.

## Storybook Usage
* UI components in `elements/` and `layout/` should have `.stories.tsx` files demonstrating their permutations.

## Coverage Expectations
Use the `.github/skills/coverage-auditor/SKILL.md` to spot gaps. All new logic branches in APIs, serializers, and utility functions should be covered.

## When to Use just Test Targets
* `just test`: Runs all backend AND frontend tests.
* `just backend-test`: Only runs `pytest`.
* `just frontend-test`: Only runs `vitest`.
