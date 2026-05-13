set dotenv-load := false

compose := "docker compose"
backend_env := "if [ ! -f .env ]; then cp .env.example .env; fi"
backend_venv := "if [ ! -x .venv/bin/python3 ]; then python3 -m venv .venv; fi"
backend_python := ".venv/bin/python3"
backend_python_targets := "conftest.py manage.py content core digest_engine entities ingestion messaging newsletters notifications pipeline projects trends users tests"
frontend_env := "if [ ! -f frontend/.env.local ]; then cp frontend/.env.example frontend/.env.local; fi"
pnpm_setup := "corepack enable && corepack prepare pnpm@11.1.0 --activate"
pnpm_exec := "pnpm"
turbo_exec := "pnpm turbo"
frontend_filter := "--filter=@digestengine/frontend"
marketing_filter := "--filter=@digestengine/marketing"
tailwind_filter := "--filter=@digestengine/tailwind-config"
django_manage := "docker compose exec django python manage.py"
host_backend_test_env := "if [ ! -x .venv/bin/python3 ]; then python3 -m venv .venv; fi && set -a && . ./.env.test && set +a &&"

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------

# Install backend Python dependencies and initialize the root env file
backend-install:
    @{{backend_env}}
    @{{backend_venv}}
    @{{backend_python}} -m pip install -r requirements.txt

# Ensure pnpm is enabled, then install JavaScript workspace dependencies
frontend-install:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{pnpm_exec}} install {{frontend_filter}}

# Ensure pnpm is enabled, then install marketing site dependencies
marketing-install:
    @{{pnpm_setup}}
    @{{pnpm_exec}} install {{marketing_filter}}

# Install pre-commit hooks when running inside a git checkout
install-hooks:
    @if git rev-parse --git-dir >/dev/null 2>&1; then {{backend_venv}} && {{backend_python}} -m pre_commit install --install-hooks; fi

# Install backend, frontend, and git hook dependencies
install: backend-install frontend-install marketing-install install-hooks

# Remove generated caches, coverage output, and frontend build artifacts
clean:
    @find . \
        \( -path './.git' -o -path './.venv' -o -path './node_modules' -o -path './frontend/node_modules' -o -path './marketing/node_modules' \) -prune -o \
        -type d \( -name '__pycache__' -o -name '.pytest_cache' -o -name '.mypy_cache' -o -name '.ruff_cache' \) -exec rm -rf {} +
    @rm -rf .coverage .turbo htmlcov frontend/.next frontend/coverage frontend/storybook-static frontend/node_modules/.cache marketing/.next marketing/node_modules/.cache

# -----------------------------------------------------------------------------
# Development And Builds
# -----------------------------------------------------------------------------

# App development tasks stay separate from the standalone marketing site.
# Use `backend-dev` with `frontend-dev` when working on the product app,
# and use `marketing-dev` on its own when working only on the marketing site.

# Start the backend development stack with Django, workers, and dependencies
backend-dev:
    @{{backend_env}}
    @{{compose}} up django celery-worker celery-beat postgres redis qdrant nginx

# Start only the app frontend development server
frontend-dev:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run dev {{frontend_filter}}

# Start the standalone marketing site development server
marketing-dev:
    @{{pnpm_setup}}
    @{{turbo_exec}} run dev {{marketing_filter}}

# Start Storybook for local frontend component development
storybook-dev:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run storybook {{frontend_filter}}

# Build the static Storybook site for production
storybook-build:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run build-storybook {{frontend_filter}}

# Start the full local docker-compose development stack
dev:
    @{{backend_env}}
    @{{compose}} up

# Build the backend Docker image used by the local stack
backend-build:
    @DOCKER_BUILDKIT=0 docker compose build django

# Build the frontend production bundle
frontend-build:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run build {{frontend_filter}}

# Build the marketing production bundle
marketing-build:
    @{{pnpm_setup}}
    @{{turbo_exec}} run build {{marketing_filter}}

# Build all TypeScript workspace applications through Turbo
typescript-build:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run build

# Build both backend and frontend deliverables
build: backend-build typescript-build

# -----------------------------------------------------------------------------
# Quality Checks
# -----------------------------------------------------------------------------

# Run the frontend TypeScript typecheck
frontend-typecheck:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run typecheck

# Lint and validate the backend Python and template code
backend-lint:
    @{{backend_venv}}
    @{{backend_python}} -m ruff check {{backend_python_targets}}
    @{{backend_python}} -m djlint core/templates --check
    @{{host_backend_test_env}} {{backend_python}} -m mypy --check-untyped-defs
    @{{backend_python}} -m pre_commit run --all-files check-yaml
    @{{host_backend_test_env}} {{backend_python}} manage.py check

# Lint and typecheck the TypeScript workspace
frontend-lint:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run typecheck lint lint:style {{frontend_filter}}
    @{{turbo_exec}} run lint:style {{tailwind_filter}}

# Lint and typecheck the standalone marketing site
marketing-lint:
    @{{pnpm_setup}}
    @{{turbo_exec}} run typecheck lint lint:style {{marketing_filter}}
    @{{turbo_exec}} run lint:style {{tailwind_filter}}

# Run all lint and validation tasks
lint: backend-lint frontend-lint marketing-lint helm-lint

# Auto-fix backend lint issues where supported, then re-run backend validation
backend-lint-fix:
    @{{backend_venv}}
    @{{backend_python}} -m ruff check {{backend_python_targets}} --fix
    @{{backend_python}} -m djlint core/templates --reformat
    @{{backend_python}} -m pre_commit run --all-files end-of-file-fixer
    @{{backend_python}} -m pre_commit run --all-files trailing-whitespace
    @just backend-lint

# Auto-fix frontend lint issues where supported
frontend-lint-fix:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run lint:fix lint:style:fix {{frontend_filter}}
    @{{turbo_exec}} run lint:style:fix {{tailwind_filter}}

# Auto-fix marketing lint issues where supported
marketing-lint-fix:
    @{{pnpm_setup}}
    @{{turbo_exec}} run lint:fix lint:style:fix {{marketing_filter}}
    @{{turbo_exec}} run lint:style:fix {{tailwind_filter}}

# Run all available lint auto-fixes
lint-fix: backend-lint-fix frontend-lint-fix marketing-lint-fix

# Format frontend source files with Prettier
frontend-format:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run format

# Check frontend formatting without modifying files
frontend-format-check:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run format:check

# Run the frontend test suite
frontend-test:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run test:run {{frontend_filter}}

# Run the marketing site test suite
marketing-test:
    @{{pnpm_setup}}
    @{{turbo_exec}} run test:run {{marketing_filter}}

# Run Storybook browser tests for frontend components
frontend-storybook-test:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run test:storybook {{frontend_filter}}

# Run the complete frontend test suite including Storybook browser tests
frontend-test-all:
    @{{frontend_env}}
    @{{pnpm_setup}}
    @{{turbo_exec}} run test:all

# Run the backend test suite
backend-test:
    @{{host_backend_test_env}} {{backend_python}} -m pytest

# Run backend tests with terminal coverage output
backend-test-coverage:
    @{{backend_venv}}
    @{{backend_python}} -m coverage erase
    @{{host_backend_test_env}} {{backend_python}} -m coverage run -m pytest
    @{{backend_python}} -m coverage report -m

# Generate backend HTML coverage output
backend-test-coverage-html: backend-test-coverage
    @{{backend_python}} -m coverage html

# Run the main backend and frontend test suites
test: backend-test frontend-test marketing-test

# -----------------------------------------------------------------------------
# Compose Runtime
# -----------------------------------------------------------------------------

# Start the full docker-compose stack in the foreground
up:
    @{{backend_env}}
    @{{compose}} up

# Start the full docker-compose stack in detached mode
up-detached:
    @{{backend_env}}
    @{{compose}} up -d

# Stop the full docker-compose stack
stop:
    @{{backend_env}}
    @{{compose}} down

# Rebuild and restart the full docker-compose stack
restart:
    @{{backend_env}}
    @{{compose}} down
    @{{compose}} up --build

# Restart the full docker-compose stack without rebuilding images
restart-no-build:
    @{{backend_env}}
    @{{compose}} down
    @{{compose}} up

# Rebuild and restart only the Django service
restart-django:
    @{{backend_env}}
    @{{compose}} build django
    @{{compose}} up -d django

# Reset local docker volumes and remove orphaned containers
reset-volumes:
    @{{backend_env}}
    @{{compose}} down -v --remove-orphans

# -----------------------------------------------------------------------------
# Django And Data Tasks
# -----------------------------------------------------------------------------

# Create a Django superuser in the running backend container
createsuperuser:
    @{{backend_env}}
    @{{compose}} exec django python manage.py createsuperuser

# Change the password for a Django user in the running backend container
changepassword username:
    @{{backend_env}}
    @{{compose}} exec django python manage.py changepassword {{username}}

# Apply Django database migrations in the running backend container
migrate:
    @{{backend_env}}
    @{{django_manage}} migrate

# Seed demo data into the running backend container
seed:
    @{{backend_env}}
    @{{compose}} exec django python manage.py seed_demo

# Bootstrap RSS and Reddit source configs for one project in the running backend container
bootstrap-live-sources project_id:
    @{{backend_env}}
    @{{django_manage}} bootstrap_live_sources \
        --project-id {{project_id}} \
        ${RSS_FEEDS:+--rss-feed "$RSS_FEEDS"} \
        ${SUBREDDITS:+--subreddit "$SUBREDDITS"} \
        ${REDDIT_LISTING:+--reddit-listing "$REDDIT_LISTING"} \
        ${REDDIT_LIMIT:+--reddit-limit "$REDDIT_LIMIT"} \
        ${RUN_NOW:+--run-now}

# Sync embeddings for all eligible content in the running backend container
embed-all:
    @{{backend_env}}
    @{{django_manage}} sync_embeddings

# Sync embeddings for a single project in the running backend container
embed-project project_id:
    @{{backend_env}}
    @{{django_manage}} sync_embeddings --project-id {{project_id}}

# Run the embedding smoke test across the default sample content in the running backend container
embed-smoke:
    @{{backend_env}}
    @{{django_manage}} embedding_smoke

# Run the embedding smoke test for a single content item in the running backend container
embed-smoke-content content_id:
    @{{backend_env}}
    @{{django_manage}} embedding_smoke --content-id {{content_id}}

# Open a Django shell in the running backend container
shell:
    @{{backend_env}}
    @{{django_manage}} shell

# Run the staged disaster recovery rehearsal workflow against the configured cluster
disaster-recovery-rehearsal:
    @{{backend_env}}
    @bash scripts/disaster_recovery_rehearsal.sh

# -----------------------------------------------------------------------------
# Helm And Kubernetes
# -----------------------------------------------------------------------------

# Lint the Helm chart configuration
helm-lint:
    @helm lint deploy/helm/digest-engine

# Render the Helm chart to a temporary output file
helm-template:
    @helm template digest-engine deploy/helm/digest-engine -f deploy/helm/digest-engine/values-minikube.yaml > /tmp/digest-engine-helm-template.yaml

# Build and load the local image into Minikube
k8s-build-minikube:
    @DOCKER_BUILDKIT=1 docker build -t digest-engine:minikube -f docker/web/Dockerfile .
    @minikube image load digest-engine:minikube

# Install or upgrade the Helm release in Minikube
k8s-install-minikube:
    @helm upgrade --install digest-engine ./deploy/helm/digest-engine -f ./deploy/helm/digest-engine/values-minikube.yaml

# Uninstall the Helm release from Minikube
k8s-uninstall-minikube:
    @helm uninstall digest-engine || true
