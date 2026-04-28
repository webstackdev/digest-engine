---
name: "Documentation Guidelines"
description: "Use when editing architecture, onboarding, operations, or product documentation in docs/**/*.md, README.md, or other repo markdown docs. Covers keeping docs aligned with code, preserving project terminology, and updating cross-links when workflows change."
applyTo:
  - "docs/**/*.md"
  - "README.md"
---

# Documentation Guidelines

- Write docs to match the current codebase, not an aspirational future design, unless the file is explicitly a roadmap or planning document.
- Use `project`, not `tenant`, unless a historical or comparative note explicitly requires the old term.
- Prefer concrete file and workflow references over vague architectural summaries.
- When a behavior changes, update the closest existing document instead of adding a new overlapping explanation.
- Keep `docs/DEVELOPER_GUIDE.md` current when the best "where to look first" path changes for contributors.
- Keep `README.md` high-level. Put detailed runtime, workflow, or operator guidance in `docs/` and link to it.
- When documenting backend behavior, align the wording with the real implementation in files like `core/models.py`, `core/tasks.py`, `core/pipeline.py`, `core/newsletters.py`, `core/api.py`, and `newsletter_maker/settings/`.
- When documenting frontend behavior, align the wording with the real implementation in `frontend/src/app/`, `frontend/src/components/`, and `frontend/src/lib/`.
- If a doc mentions commands, prefer the repo's real commands from `justfile`, `package.json`, or `manage.py`.
- If a code change affects logging, relevance scoring, ingestion, newsletter intake, or onboarding, check whether `docs/LOGGING.md`, `docs/RELEVANCE_SCORING.md`, `docs/IMPLEMENTATION_OVERVIEW.md`, or `docs/DEVELOPER_GUIDE.md` should change too.

## Style

- Favor short sections and direct statements over long narrative paragraphs.
- Use bullets for operational steps and comparisons.
- Avoid copying large blocks of code into docs when a file path and a short explanation are enough.
- Keep terminology consistent across docs, admin UI descriptions, and code comments.

## Good Anchors

- `docs/DEVELOPER_GUIDE.md`
- `docs/IMPLEMENTATION_OVERVIEW.md`
- `docs/MODELS.md`
- `docs/RELEVANCE_SCORING.md`
- `docs/LOGGING.md`
- `README.md`
