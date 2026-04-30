# Session Restore Point

## Current Focus

`R5` is landed, and the first trends follow-on is landed: `TopicCentroidSnapshot` ownership moved into the new `trends` app while `core.pipeline` and `core.tasks` remain the behavior layer for the orchestration and centroid recomputation logic.

## Exact Stopping Point

`R4` is complete, `R5` is complete, and the first trends follow-on move is complete: newsletter ownership moved into `newsletters`, pipeline ownership moved into `pipeline`, `TopicCentroidSnapshot` ownership moved into `trends`, the paired state-only migrations are applied, and the focused checks are green.

The current shape intentionally leaves these compatibility seams in place:

- `core.pipeline` still owns the execution logic that creates and updates the moved rows
- `core.tasks` still owns centroid recomputation behavior even though the snapshot model now lives in `trends`
- `core.models`, `core.serializers`, and `core.admin` still re-export moved symbols for compatibility
- `core.api` still provides shared project-route helpers that the moved app APIs import

## First Move Tomorrow

If work resumes here, start from the remaining compatibility decision and the broader trends build-out rather than another pipeline move:

- `core/pipeline.py` and `core/tasks.py` for the execution path that still mutates these rows
- `trends/` for the rest of the Phase 3 model set that should now land there directly
- any remaining temporary compatibility re-exports in `core.*` that we may want to retire later

If another move happens, keep using `SeparateDatabaseAndState` and keep the existing tables in place. Do not run a normal schema move.
