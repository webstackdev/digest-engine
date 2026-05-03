set dotenv-load := true

compose := "docker compose"
backend_env := "if [ ! -f .env ]; then cp .env.example .env; fi"
frontend_env := "if [ ! -f frontend/.env.local ]; then cp frontend/.env.example frontend/.env.local; fi"
frontend_cd := "cd frontend &&"

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------

# Install backend Python dependencies and initialize the root env file
backend-install:
    @{{backend_env}}
    @python3 -m pip install -r requirements.txt

# Install frontend npm dependencies
frontend-install:
    @{{frontend_cd}} npm install

# Install backend, frontend, and git hook dependencies
install: backend-install frontend-install install-hooks

# Install pre-commit hooks when running inside a git checkout
install-hooks:
    @if git rev-parse --git-dir >/dev/null 2>&1; then pre-commit install --install-hooks; fi

# -----------------------------------------------------------------------------
# Development And Builds
# -----------------------------------------------------------------------------

# Start the backend development stack with Django, workers, and dependencies
backend-dev:
    @{{backend_env}}
    @{{compose}} up django celery-worker celery-beat postgres redis qdrant nginx

# Start the Next.js frontend development server
frontend-dev:
    @{{frontend_env}}
    @{{frontend_cd}} npm run dev

# Start Storybook for local frontend component development
storybook-dev:
    @{{frontend_env}}
    @{{frontend_cd}} npm run storybook

# Build the static Storybook site for production
storybook-build:
    @{{frontend_env}}
    @{{frontend_cd}} npm run build-storybook

# Start the full local docker-compose development stack
dev:
    @{{backend_env}}
    @{{compose}} up

# Build the backend Docker image used by the local stack
backend-build:
    @{{backend_env}}
    @{{compose}} build django

# Build the frontend production bundle
frontend-build:
    @{{frontend_env}}
    @{{frontend_cd}} npm run build

# Build both backend and frontend deliverables
build: backend-build frontend-build

# -----------------------------------------------------------------------------
# Quality Checks
# -----------------------------------------------------------------------------

# Run the frontend TypeScript typecheck
frontend-typecheck:
    @{{frontend_env}}
    @{{frontend_cd}} npm run typecheck

# Lint and validate the backend Python and template code
backend-lint:
    @{{backend_env}}
    @ruff check manage.py core newsletter_maker tests
    @djlint core/templates --check
    @python3 -m mypy
    @pre-commit run --all-files check-yaml
    @python3 manage.py check

# Lint and typecheck the frontend codebase
frontend-lint:
    @{{frontend_env}}
    @{{frontend_cd}} npm run typecheck
    @{{frontend_cd}} npm run lint

# Run all lint and validation tasks
lint: backend-lint frontend-lint helm-lint

# Auto-fix backend lint issues where supported, then re-run backend validation
backend-lint-fix:
    @{{backend_env}}
    @ruff check manage.py core newsletter_maker tests --fix
    @djlint core/templates --reformat
    @pre-commit run --all-files end-of-file-fixer
    @pre-commit run --all-files trailing-whitespace
    @just backend-lint

# Auto-fix frontend lint issues where supported
frontend-lint-fix:
    @{{frontend_env}}
    @{{frontend_cd}} npm run lint:fix

# Run all available lint auto-fixes
lint-fix: backend-lint-fix frontend-lint-fix

# Format frontend source files with Prettier
frontend-format:
    @{{frontend_env}}
    @{{frontend_cd}} npm run format

# Check frontend formatting without modifying files
frontend-format-check:
    @{{frontend_env}}
    @{{frontend_cd}} npm run format:check

# Run the frontend test suite
frontend-test:
    @{{frontend_env}}
    @{{frontend_cd}} npm run test:run

# Run the backend test suite
backend-test:
    @python3 -m pytest

# Run backend tests with terminal coverage output
backend-test-coverage:
    @python3 -m coverage erase
    @python3 -m coverage run -m pytest
    @python3 -m coverage report -m

# Generate backend HTML coverage output
backend-test-coverage-html: backend-test-coverage
    @python3 -m coverage html

# Run the main backend and frontend test suites
test: backend-test frontend-test

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

# Apply Django database migrations locally
migrate:
    @{{backend_env}}
    @python3 manage.py migrate

# Seed demo data into the running backend container
seed:
    @{{backend_env}}
    @{{compose}} exec django python manage.py seed_demo

# Sync embeddings for all eligible content
embed-all:
    @{{backend_env}}
    @python3 manage.py sync_embeddings

# Sync embeddings for a single project
embed-project project_id:
    @{{backend_env}}
    @python3 manage.py sync_embeddings --project-id {{project_id}}

# Run the embedding smoke test across the default sample content
embed-smoke:
    @{{backend_env}}
    @python3 manage.py embedding_smoke

# Run the embedding smoke test for a single content item
embed-smoke-content content_id:
    @{{backend_env}}
    @python3 manage.py embedding_smoke --content-id {{content_id}}

# Open a local Django shell
shell:
    @{{backend_env}}
    @python3 manage.py shell

# Run the staged disaster recovery rehearsal workflow against the configured cluster
disaster-recovery-rehearsal:
    @{{backend_env}}
    @bash scripts/disaster_recovery_rehearsal.sh

# -----------------------------------------------------------------------------
# Helm And Kubernetes
# -----------------------------------------------------------------------------

# Lint the Helm chart configuration
helm-lint:
    @helm lint deploy/helm/newsletter-maker

# Render the Helm chart to a temporary output file
helm-template:
    @helm template newsletter-maker deploy/helm/newsletter-maker -f deploy/helm/newsletter-maker/values-minikube.yaml > /tmp/newsletter-maker-helm-template.yaml

# Build and load the local image into Minikube
k8s-build-minikube:
    @DOCKER_BUILDKIT=1 docker build -t newsletter-maker:minikube -f docker/web/Dockerfile .
    @minikube image load newsletter-maker:minikube

# Install or upgrade the Helm release in Minikube
k8s-install-minikube:
    @helm upgrade --install newsletter-maker ./deploy/helm/newsletter-maker -f ./deploy/helm/newsletter-maker/values-minikube.yaml

# Uninstall the Helm release from Minikube
k8s-uninstall-minikube:
    @helm uninstall newsletter-maker || true
