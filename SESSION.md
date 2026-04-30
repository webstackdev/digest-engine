# Session Restore Point

## Exact Stopping Point

`R4` is complete, `R5` is complete, and the first trends follow-on move is complete: newsletter ownership moved into `newsletters`, pipeline ownership moved into `pipeline`, `TopicCentroidSnapshot` ownership moved into `trends`, the paired state-only migrations are applied, and the focused checks are green.

The current shape intentionally leaves these compatibility seams in place:

- `core.pipeline` still owns the execution logic that creates and updates the moved rows
- `trends.tasks` owns centroid recomputation behavior while `core.tasks` re-exports the moved task symbols for compatibility
- `core.models`, `core.serializers`, and `core.admin` still re-export moved symbols for compatibility
- `core.api` still provides shared project-route helpers that the moved app APIs import

## First Move Tomorrow

If work resumes here, start from the remaining compatibility decision and the broader trends build-out rather than another pipeline move:

- `core/pipeline.py` for the execution path that still mutates the moved pipeline rows
- `trends/tasks.py` and `trends/` for the centroid workflow and the rest of the Phase 3 model set that should land there directly
- any remaining temporary compatibility re-exports in `core.*` that we may want to retire later

If another move happens, keep using `SeparateDatabaseAndState` and keep the existing tables in place. Do not run a normal schema move.
