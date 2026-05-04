# Installation

## Minimum Requirements
* 4 CPU Cores (8 recommended if running Ollama locally).
* 8 GB RAM (16GB recommended if running Ollama locally).
* Postgres 14+, Redis 7+.

## Docker Compose Path
The easiest way to stand up a single VPS is Docker Compose:
1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in secrets.
3. Run `docker compose build`.
4. Run `docker compose up -d`.
5. Run migrations: `docker compose exec django python manage.py migrate`.

## Helm + ArgoCD Path
For Kubernetes usage, an ArgoCD App configuration lives in `deploy/argocd` pointing to the Helm chart in `deploy/helm`. Configure your values file with the required secrets (or rely on ExternalSecrets).

## First-Run Checklist
1. Ensure containers are healthy (`docker compose ps`).
2. Run database migrations.
3. Create the superuser (see below).
4. Run `docker compose exec django python manage.py bootstrap_live_sources` to seed default RSS/Reddit connections.

## Creating the First Superuser
```bash
docker compose exec django python manage.py createsuperuser
```

## Smoke Test
Log into the dashboard. Go to settings and add an RSS feed. If the `Ingestion Settings` page shows health check successes within 5 minutes, Celery, Postgres, and the Network are functional.
