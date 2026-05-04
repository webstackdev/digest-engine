# Local Development

Newsletter Maker uses a **two-workflow split** to isolate fast local iteration from full full-stack fidelity.

## The Two-Workflow Split
1. **Host-Side Track**: Used for fast linting, typechecking, and unit tests WITHOUT spinning up Docker. 
2. **Docker Track**: Used for running the application, seeing the UI, background workers, and Postgres.

## Host-Side Track
When you run commands on your local OS (e.g., `just lint`, `just test`, `just frontend-lint`):
- Django reads from `.env.test`.
- `DATABASE_URL` defaults to `sqlite:///:memory:` for instantaneous migrations/tests.
- No Redis or Qdrant is required for basic unit test stubs.

## Docker Track
When you want to run the app:
```bash
just build  # Env-free container build (DOCKER_BUILDKIT=0)
docker compose up -d
```
When running the Docker track, all runtime commands must be executed **inside the container**:
```bash
docker compose exec django python manage.py migrate
docker compose exec django python manage.py bootstrap_live_sources
```

## Celery Beat Schedule
The Celery beat schedule file (`celerybeat-schedule`) is written to `.cache/` to prevent dirtying the project root or colliding between host/container environments.

## Frontend Dev Loop
For iterating purely on the Next.js app while the backend runs in Docker:
```bash
cd frontend && npm run dev
```

## When to Use Which Workflow
* **Writing code, running tests, checking types**: Host-side (`just lint`, `just test`).
* **Testing LLMs, seeing the UI, testing ingestion, full pipelines**: Docker Track (`docker compose up`).
