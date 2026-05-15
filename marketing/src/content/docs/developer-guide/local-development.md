# Local Development

Digest Engine uses a **two-workflow split** to isolate fast local iteration from full full-stack fidelity.

## The Two-Workflow Split

1. **Host-Side Track**: Used for fast linting, typechecking, and unit tests WITHOUT spinning up Docker.
2. **Docker Track**: Used for running the application, seeing the UI, background workers, and Postgres.

## Host-Side Track

When you run commands on your local OS (e.g., `just lint`, `just test`, `just frontend-lint`):

- Django reads from `.env.test`.
- `DATABASE_URL` defaults to `sqlite:///:memory:` for instantaneous migrations/tests.
- No Redis or Qdrant is required for basic unit test stubs.

Bootstrap a fresh clone with `./scripts/bootstrap_dev.sh` on Linux or macOS. On other platforms, install `uv` first and then run `just install` from the repo root.

## Docker Track

When you want to run the app:

```bash
just build
just dev
```

`just dev` runs the full Docker Compose stack in the foreground and keeps streaming service logs. Leave it running in the first terminal.

Open a second terminal for follow-up commands against the running stack:

```bash
just seed
```

After seeding completes, open <http://localhost:8080/> in your browser.

## Celery Beat Schedule

The Celery beat schedule file (`celerybeat-schedule`) is written to `.cache/` to prevent dirtying the project root or colliding between host/container environments.

## Frontend Dev Loop

For iterating purely on the Next.js app while the backend runs in Docker:

```bash
cd frontend && npm run dev
```

## When to Use Which Workflow

- **Writing code, running tests, checking types**: Host-side (`just lint`, `just test`).
- **Testing LLMs, seeing the UI, testing ingestion, full pipelines**: Docker Track (`just dev`).
