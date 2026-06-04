# Session Restore Point

## Completed Refactor: Celery To Taskiq

Goal: replace Celery with Taskiq across the Django runtime, scheduled jobs, deployment manifests, and tests without changing the user-facing behavior of ingestion, AI pipeline execution, newsletter drafting, trend jobs, or avatar processing. This migration should prefer async-native task implementations rather than keeping the existing synchronous task bodies and merely adapting the queue layer.

### Current Status

- Python runtime task modules now use Taskiq end to end. The old Celery bootstrap and Celery settings modules have been deleted.
- Telemetry and dependency manifests no longer carry Celery runtime wiring. `uv.lock` and the Pants lockfile were regenerated after removing the Celery packages.
- Local and Helm runtime manifests now use Taskiq worker and scheduler processes and provision RabbitMQ explicitly for the Taskiq broker.
- Test and env harnesses now use `TASKIQ_ALWAYS_EAGER` instead of `CELERY_TASK_ALWAYS_EAGER` across the executable repo surfaces.
- A targeted repo grep across executable code, tests, deploy manifests, env examples, and scripts no longer finds Celery-specific runtime references.
- Public top-level docs now describe the Taskiq-based stack. Remaining Celery mentions are confined to historical planning text in this file.

### Validated In This Session

- Regenerated dependency locks with `uv lock` and `pants generate-lockfiles --resolve=python-default`.
- Rendered local and deployed runtime config successfully with `docker compose config` and `helm template digest-engine ./deploy/helm/digest-engine`.
- Re-ran `python manage.py check` after the telemetry, dependency, and deployment edits.
- Re-ran focused pytest slices covering newsletters, users profile API, core eager paths, trends, entities, ingestion, and pipeline retry behavior after replacing the Celery-era eager test harness.

### Remaining Follow-Up

- Optional documentation cleanup only: historical Celery terminology remains in this planning note and any external runbooks or dashboards that are not stored in this repo.
- No executable repo surfaces still depend on Celery.

### Current Queue Surface

- Taskiq bootstrap lives in [digest_engine/taskiq.py](/home/kevin/Repos/digest-engine/digest_engine/taskiq.py).
- Taskiq settings live in [digest_engine/settings/taskiq.py](/home/kevin/Repos/digest-engine/digest_engine/settings/taskiq.py) and are re-exported from [digest_engine/settings/__init__.py](/home/kevin/Repos/digest-engine/digest_engine/settings/__init__.py).
- Task modules now migrated to Taskiq live in:
  - [core/tasks.py](/home/kevin/Repos/digest-engine/core/tasks.py)
  - [ingestion/tasks.py](/home/kevin/Repos/digest-engine/ingestion/tasks.py)
  - [newsletters/tasks.py](/home/kevin/Repos/digest-engine/newsletters/tasks.py)
  - [entities/tasks.py](/home/kevin/Repos/digest-engine/entities/tasks.py)
  - [trends/tasks.py](/home/kevin/Repos/digest-engine/trends/tasks.py)
  - [users/ninja_api.py](/home/kevin/Repos/digest-engine/users/ninja_api.py)
- Task dispatch from synchronous Django entrypoints now goes through the shared enqueue seam in [digest_engine/taskiq.py](/home/kevin/Repos/digest-engine/digest_engine/taskiq.py).
- Local and deployed worker scheduling now depends on Taskiq worker and Taskiq scheduler in:
  - [docker-compose.yml](/home/kevin/Repos/digest-engine/docker-compose.yml)
  - [justfile](/home/kevin/Repos/digest-engine/justfile)
  - [deploy/helm/digest-engine/values.yaml](/home/kevin/Repos/digest-engine/deploy/helm/digest-engine/values.yaml)
  - [deploy/helm/digest-engine/templates/taskiq-worker-deployment.yaml](/home/kevin/Repos/digest-engine/deploy/helm/digest-engine/templates/taskiq-worker-deployment.yaml)
  - [deploy/helm/digest-engine/templates/taskiq-scheduler-deployment.yaml](/home/kevin/Repos/digest-engine/deploy/helm/digest-engine/templates/taskiq-scheduler-deployment.yaml)
  - [deploy/helm/digest-engine/templates/keda-scaledobject.yaml](/home/kevin/Repos/digest-engine/deploy/helm/digest-engine/templates/keda-scaledobject.yaml)
- Current entrypoint coverage assumes Taskiq broker and scheduler bootstrap in [core/tests/test_entrypoints.py](/home/kevin/Repos/digest-engine/core/tests/test_entrypoints.py).
- RabbitMQ is now provisioned in local and Helm deployment surfaces alongside Redis result storage.

### Design Constraints

- Preserve the current eager-mode ergonomics used in tests and local control flow, where some orchestration tasks run inline when background execution is disabled.
- Preserve task names and call semantics long enough to migrate callers incrementally instead of forcing a big-bang rename.
- Preserve existing schedule cadence from [digest_engine/settings/celery.py](/home/kevin/Repos/digest-engine/digest_engine/settings/celery.py) until behavior is intentionally changed.
- Keep the AI pipeline boundaries intact: persisted state in models, orchestration in task modules, pipeline logic in app-owned helpers.
- Treat async-first task execution as the default target. Only keep synchronous execution where a dependency is fundamentally blocking or CPU-bound.
- Be explicit about sync boundaries in Django and library code. Moving to Taskiq does not make Django ORM, Pillow/image manipulation, or CPU-heavy transforms automatically async.

### Phase 1 Decisions

- Adopt `taskiq` as the core queue runtime.
- Use `taskiq-aio-pika` for the primary broker and RabbitMQ as the production queue transport.
- Use `taskiq-redis` for Redis-backed result storage and any Redis-backed scheduling helpers we later decide to add.
- Start with core `TaskiqScheduler` plus `LabelScheduleSource` for the current fixed recurring schedules. Revisit dynamic Redis-backed schedules only if product requirements appear.
- Keep one shared broker/bootstrap module under `digest_engine/`, analogous to the current Celery entrypoint, but Taskiq-native.
- Replace `CELERY_TASK_ALWAYS_EAGER` with a repo-owned Taskiq-era setting and test harness, rather than preserving Celery naming.
- Plan for an async-first rewrite of task definitions. A sync-safe enqueue helper may still exist for synchronous Django call sites, but that helper should bridge caller context to Taskiq and not be treated as justification to keep task implementations mostly synchronous.

### Explicit Sync Boundaries

These boundaries are the agreed exceptions to the async-first direction. Async Taskiq handlers should treat these as explicit handoff points instead of letting blocking work leak through the task layer.

#### 1. Sync Django Entrypoints That Need A Sync-Safe Enqueue Seam

- Admin actions:
  - [projects/admin.py](/home/kevin/Repos/digest-engine/projects/admin.py) `ProjectConfigAdmin.recompute_selected_authority_models`
  - [content/admin.py](/home/kevin/Repos/digest-engine/content/admin.py) `ContentAdmin.generate_newsletter_ideas`
  - [pipeline/admin.py](/home/kevin/Repos/digest-engine/pipeline/admin.py) review-queue retry admin action
- Management commands:
  - [core/management/commands/bootstrap_live_sources.py](/home/kevin/Repos/digest-engine/core/management/commands/bootstrap_live_sources.py) source bootstrap ingestion dispatch
- Sync Ninja or Django request handlers:
  - [newsletters/ninja_api.py](/home/kevin/Repos/digest-engine/newsletters/ninja_api.py) `generate_newsletter_draft_route`
  - [newsletters/ninja_api.py](/home/kevin/Repos/digest-engine/newsletters/ninja_api.py) `regenerate_newsletter_draft_section_route`
  - [pipeline/ninja_api.py](/home/kevin/Repos/digest-engine/pipeline/ninja_api.py) `retry_review_queue_item_route`
  - [trends/ninja_api.py](/home/kevin/Repos/digest-engine/trends/ninja_api.py) original-content idea generation route
  - [projects/ninja_project_configs_api.py](/home/kevin/Repos/digest-engine/projects/ninja_project_configs_api.py) authority and source-quality recompute trigger
  - [users/ninja_api.py](/home/kevin/Repos/digest-engine/users/ninja_api.py) local task enqueue helper for avatar thumbnail generation
  - [newsletters/intake.py](/home/kevin/Repos/digest-engine/newsletters/intake.py) `queue_newsletter_intake`
- Scope rule: these call sites should remain synchronous request or command code, but all queue submission should go through one repo-owned Taskiq enqueue helper rather than direct broker calls spread across the codebase.

#### 2. ORM-Heavy Sync Units

- The following task modules are dominated by synchronous Django ORM work and should be treated as sync data-access units even when their Taskiq entrypoints become `async def`:
  - [core/tasks.py](/home/kevin/Repos/digest-engine/core/tasks.py)
  - [ingestion/tasks.py](/home/kevin/Repos/digest-engine/ingestion/tasks.py)
  - [newsletters/tasks.py](/home/kevin/Repos/digest-engine/newsletters/tasks.py)
  - [entities/tasks.py](/home/kevin/Repos/digest-engine/entities/tasks.py)
  - [trends/tasks.py](/home/kevin/Repos/digest-engine/trends/tasks.py)
  - [users/tasks.py](/home/kevin/Repos/digest-engine/users/tasks.py)
- The heaviest downstream ORM helpers that should stay behind explicit sync boundaries are:
  - [core/pipeline.py](/home/kevin/Repos/digest-engine/core/pipeline.py)
  - [newsletters/composition.py](/home/kevin/Repos/digest-engine/newsletters/composition.py)
  - [entities/extraction.py](/home/kevin/Repos/digest-engine/entities/extraction.py)
- Scope rule: async Taskiq handlers may orchestrate these calls, but database-intensive units should be isolated with `sync_to_async`, thread offloading, or dedicated synchronous helper functions rather than mixing raw ORM calls directly throughout async control flow.

#### 3. CPU-Bound Or File-Bound Work

- [users/tasks.py](/home/kevin/Repos/digest-engine/users/tasks.py) `build_avatar_thumbnail`
  - Uses Pillow image decoding, EXIF transpose, resize, WebP encoding, and storage writes.
  - This should remain a sync helper invoked via thread or executor offload.
- [newsletters/extraction.py](/home/kevin/Repos/digest-engine/newsletters/extraction.py) `_extract_newsletter_items_heuristically`
  - Uses `HTMLParser` and regex-based extraction over raw newsletter bodies.
  - This is a reasonable sync parsing unit and does not need to be forced async.
- [entities/tasks.py](/home/kevin/Repos/digest-engine/entities/tasks.py) candidate clustering and identity-enrichment helpers
  - Includes string-similarity clustering and content normalization work alongside ORM access.
  - Keep the compute-heavy portions behind explicit sync boundaries unless a clear async benefit appears.
- [core/embeddings.py](/home/kevin/Repos/digest-engine/core/embeddings.py) sentence-transformer embedding generation
  - Local model inference is blocking compute work even if the surrounding task becomes async.

#### 4. Blocking Third-Party Clients And Libraries

- HTTP clients currently used in synchronous mode:
  - [core/llm.py](/home/kevin/Repos/digest-engine/core/llm.py) `httpx.post` for OpenRouter chat completions
  - [core/embeddings.py](/home/kevin/Repos/digest-engine/core/embeddings.py) `httpx.post` for Ollama and OpenRouter embeddings
  - [content/deduplication.py](/home/kevin/Repos/digest-engine/content/deduplication.py) `httpx.head` for short-link expansion
  - [entities/tasks.py](/home/kevin/Repos/digest-engine/entities/tasks.py) `httpx.get` for identity probing
- Sync SDKs and parsers that should be assumed blocking unless replaced:
  - [ingestion/plugins/linkedin.py](/home/kevin/Repos/digest-engine/ingestion/plugins/linkedin.py) `requests.post`
  - [ingestion/plugins/rss.py](/home/kevin/Repos/digest-engine/ingestion/plugins/rss.py) `feedparser.parse`
  - [ingestion/plugins/reddit.py](/home/kevin/Repos/digest-engine/ingestion/plugins/reddit.py) `praw.Reddit`
  - [entities/tasks.py](/home/kevin/Repos/digest-engine/entities/tasks.py) `atproto.Client`
  - [entities/tasks.py](/home/kevin/Repos/digest-engine/entities/tasks.py) `mastodon.Mastodon`
  - [core/embeddings.py](/home/kevin/Repos/digest-engine/core/embeddings.py) `QdrantClient`
- Scope rule:
  - Convert `httpx` usage to `httpx.AsyncClient` where practical.
  - Keep obviously sync-only libraries behind thread offload unless we replace them with async-capable alternatives.
  - Treat Qdrant and embedding provider access as explicit boundaries inside the embedding layer, not as direct async logic scattered across tasks.

#### 5. Existing Sync-To-Async Precedent

- [messaging/signals.py](/home/kevin/Repos/digest-engine/messaging/signals.py) and [notifications/signals.py](/home/kevin/Repos/digest-engine/notifications/signals.py) already use `async_to_sync` to bridge sync Django signals into async channel-layer operations.
- Scope rule: use the same style of narrow bridge for Taskiq enqueueing from sync Django entrypoints, but do not use that bridge as a reason to keep task implementations themselves predominantly synchronous.

### Migration Record

The original phase plan below is preserved as a historical record of the migration approach that landed. The runtime, dependency, deploy, and test-harness work described there is now complete.

### Proposed Implementation Plan

#### Phase 1: Choose The Taskiq Runtime Shape

- Implement the selected Taskiq stack for this repo:
  - `taskiq`
  - `taskiq-aio-pika`
  - `taskiq-redis`
- Define the Django bootstrap module and Taskiq broker wiring under `digest_engine/`.
- Define the initial scheduler shape using core `TaskiqScheduler` and `LabelScheduleSource` for code-owned recurring jobs.
- Define the replacement for `CELERY_TASK_ALWAYS_EAGER`, likely a Taskiq-specific eager/immediate execution setting plus a local helper seam for tests.

#### Phase 2: Introduce A Taskiq Compatibility Layer

- Add Taskiq dependencies to [pyproject.toml](/home/kevin/Repos/digest-engine/pyproject.toml) and regenerate [3rdparty/python/default.lock](/home/kevin/Repos/digest-engine/3rdparty/python/default.lock).
- Create a new broker/bootstrap module under `digest_engine/` to initialize Taskiq against Django settings, RabbitMQ, and Redis result storage.
- Add a small dispatch abstraction that replaces direct `.delay(...)` knowledge with one repo-owned seam, so synchronous Django callers can enqueue Taskiq work safely while the internals move to async-first execution.
- Add settings for broker URL, Redis result backend, eager mode, timeout/retry defaults, and scheduler configuration without removing Celery yet.
- Keep this first slice additive so the repo can compile and tests can run before task modules are ported.

#### Phase 3: Port Task Definitions Module By Module

- Migrate [core/tasks.py](/home/kevin/Repos/digest-engine/core/tasks.py) first because it is the largest cross-cutting orchestration surface and defines helper patterns reused elsewhere.
- Port the remaining task modules in dependency order:
  - [ingestion/tasks.py](/home/kevin/Repos/digest-engine/ingestion/tasks.py)
  - [newsletters/tasks.py](/home/kevin/Repos/digest-engine/newsletters/tasks.py)
  - [trends/tasks.py](/home/kevin/Repos/digest-engine/trends/tasks.py)
  - [entities/tasks.py](/home/kevin/Repos/digest-engine/entities/tasks.py)
  - [users/tasks.py](/home/kevin/Repos/digest-engine/users/tasks.py)
- Replace `@shared_task(...)` with the Taskiq task decorator strategy selected in Phase 1.
- Convert task entrypoints to `async def` where the surrounding work can be made async with reasonable effort.
- Replace synchronous external I/O inside tasks with async-capable clients where available.
- Move unavoidable synchronous work behind explicit boundaries such as `sync_to_async`, `asyncio.to_thread`, or executor-based helpers rather than leaving whole task modules synchronous by default.
- Replace local `DelayedTask` / `_enqueue_task` helpers with a broker-agnostic enqueue helper that supports immediate execution where required.
- Verify that task return values, ignored results, retries, logging behavior, and async error handling remain acceptable for each converted module.

#### Phase 4: Replace Call Sites And Scheduling

- Replace `.delay(...)` dispatch from runtime callers with the new enqueue seam in these high-signal surfaces first. Prefer async-native call sites when already in async contexts; use a narrow sync-to-async bridge only where Django entrypoints remain synchronous:
  - [newsletters/intake.py](/home/kevin/Repos/digest-engine/newsletters/intake.py)
  - [newsletters/ninja_api.py](/home/kevin/Repos/digest-engine/newsletters/ninja_api.py)
  - [projects/admin.py](/home/kevin/Repos/digest-engine/projects/admin.py)
  - [projects/ninja_project_configs_api.py](/home/kevin/Repos/digest-engine/projects/ninja_project_configs_api.py)
  - [content/admin.py](/home/kevin/Repos/digest-engine/content/admin.py)
  - [pipeline/admin.py](/home/kevin/Repos/digest-engine/pipeline/admin.py)
  - [pipeline/ninja_api.py](/home/kevin/Repos/digest-engine/pipeline/ninja_api.py)
  - [trends/ninja_api.py](/home/kevin/Repos/digest-engine/trends/ninja_api.py)
  - [core/management/commands/bootstrap_live_sources.py](/home/kevin/Repos/digest-engine/core/management/commands/bootstrap_live_sources.py)
  - [entities/extraction.py](/home/kevin/Repos/digest-engine/entities/extraction.py)
- Recreate the current recurring schedules from [digest_engine/settings/celery.py](/home/kevin/Repos/digest-engine/digest_engine/settings/celery.py) in the Taskiq scheduler layer.
- Keep schedule names and cadence recognizable so operational diffs are easy to review.

#### Phase 5: Replace Worker, Scheduler, And Deployment Wiring

- Update [digest_engine/settings/__init__.py](/home/kevin/Repos/digest-engine/digest_engine/settings/__init__.py) to export Taskiq settings instead of Celery settings.
- Remove [digest_engine/celery.py](/home/kevin/Repos/digest-engine/digest_engine/celery.py) once all imports are gone and replace it with the Taskiq broker entrypoint.
- Update local development commands in [justfile](/home/kevin/Repos/digest-engine/justfile) to start Taskiq worker and scheduler processes instead of Celery worker and beat.
- Update [docker-compose.yml](/home/kevin/Repos/digest-engine/docker-compose.yml) service names and commands for Taskiq runtime processes.
- Update Helm values, worker/scheduler deployments, KEDA config, and network policy references under [deploy/helm/digest-engine](/home/kevin/Repos/digest-engine/deploy/helm/digest-engine).
- Replace Celery-specific OpenTelemetry instrumentation in [pyproject.toml](/home/kevin/Repos/digest-engine/pyproject.toml) with the Taskiq equivalent if one is available; otherwise document the temporary observability gap.

#### Phase 6: Remove Celery And Finish Cleanup

- Delete Celery settings module and any remaining `CELERY_*` environment variables once Taskiq config is live.
- Remove Celery dependency and Celery instrumentation from [pyproject.toml](/home/kevin/Repos/digest-engine/pyproject.toml).
- Regenerate Pants lockfiles after dependency changes.
- Update tests that currently assert Celery app bootstrapping and beat schedule behavior, starting with [core/tests/test_entrypoints.py](/home/kevin/Repos/digest-engine/core/tests/test_entrypoints.py).
- Search for remaining `celery`, `shared_task`, `.delay(`, `apply_async`, `celery-worker`, and `celery-beat` references and remove or rename them.
- Update operator and contributor docs once the runtime commands and deployment terminology change.

### Suggested Validation Per Phase

- After Phase 2: run a narrow import/config check for the new broker bootstrap plus `python manage.py check`.
- After each task-module migration: run the nearest focused pytest module plus `python manage.py check`.
- After scheduler migration: add or update targeted tests for scheduled job registration and cadence.
- After compose/helm changes: run `just lint` and the existing Helm lint target.
- Before deleting Celery: run `just test` and confirm no repo matches for Celery runtime imports remain outside historical notes.

### Risks To Watch

- Taskiq scheduling semantics may not match Celery beat exactly, especially for mixed interval and cron jobs.
- Taskiq retry and result-handling behavior may differ from Celery for long-running AI or ingestion jobs.
- Existing eager-mode assumptions may be embedded in tests or orchestration helpers and need an explicit compatibility shim.
- A fully async rewrite will expose blocking dependencies that were previously hidden inside synchronous Celery workers, especially ORM-heavy code paths and CPU-bound helpers.
- Some code paths may only become partially async because Django ORM usage, image processing, or third-party SDKs still require thread or process offloading.
- Telemetry coverage may regress if Celery instrumentation is removed before a Taskiq replacement is wired.
- Deployment naming changes may require coordinated updates in dashboards, scaling policies, and operator expectations.

### Immediate Next Step

- No runtime migration work remains in-repo. If a future pass is needed, limit it to historical wording cleanup and external operator collateral.
