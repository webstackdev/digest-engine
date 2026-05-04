# Newsletter Maker

![Image of AI-powered newsletter workflow](readme.jpg)

An AI-powered content curation platform for technically-oriented newsletters. Newsletter Maker ingests content from dozens of sources, builds authority models of people and companies in a domain, and surfaces the most relevant articles, trends, and themes for each edition — so editors spend their time writing, not searching.

The system is organized into projects: each newsletter project has its own tracked entities, relevance model, and content pipeline. Projects are assigned to Django groups so editorial access can be shared cleanly. Designed for non-technical editors who don't know what a vector database is and don't need to.

## What This Does That Existing Tools Don't

Tools like Feedly, UpContent, and ContentStudio handle parts of the content curation problem. Newsletter Maker combines several capabilities none of them offer:

- **Authority scoring from newsletter cross-referencing.** By ingesting peer newsletters, the system builds an authority model based on who real editors actually link to — a human-curated endorsement signal no existing tool provides.
- **Per-project relevance training.** Upvote/downvote feedback trains a personalized relevance model per project. The tool learns what each editorial project considers valuable.
- **Unified entity model.** A person's blog, LinkedIn, Bluesky, GitHub, and conference talks are linked into a single profile with an authority score — a holistic view of who matters in a space.
- **Competitive intelligence.** "These 3 peer newsletters all covered topic X this week, but you haven't." A natural output of newsletter ingestion that no curation tool provides.
- **Historical trend analysis.** Not just what's trending now, but trajectories over weeks. Content is retained indefinitely for long-term pattern detection.

## Architecture Highlights

### Composable AI Skills

Every AI capability is a standalone, documented module following the Claude Skills progressive disclosure format:

1. **Metadata layer** — name and trigger description (all the orchestrator sees during routing)
2. **Instructions layer** — the full standard operating procedure for the task
3. **Resources layer** — deterministic scripts, reference data, and templates

Seven skills form the core pipeline:

| Skill | Description |
| ----- | ----------- |
| **Content Classification** | Categorizes raw content (e.g., tutorial, opinion, release notes) and assigns a confidence score. |
| **Relevance Scoring** | Evaluates content usefulness using semantic similarity against a reference corpus and LLM judgment. |
| **Deduplication** | Compares new content against recent embeddings to group similar topics and pick the best version. |
| **Summarization** | Generates a concise, newsletter-ready summary for editors to use or tweak directly. |
| **Theme Detection** | Analyzes recent content to identify emerging trends and suggest them as newsletter sections. |
| **Newsletter Email Extraction** | Parses raw inbound newsletter HTML to extract structured links, titles, authors, and descriptions. |
| **Entity Extraction** | Identifies people, companies, and organizations in content to build out the unified entity model. |

Each has a defined input/output schema and is independently invocable — from the pipeline, from the UI, or chained into user-defined workflows.

The skill format is model-agnostic. The same skill definitions work with Claude, GPT, Qwen, Llama, DeepSeek, Command R+, and Gemma. Models can be used via API calls like OpenRouter or locally via Ollama. The model is a configuration parameter, not a hard coded dependency. There are recommended models to use with each skill based on suitability and cost.

### LangGraph Orchestration

Skills are composed into workflows by LangGraph to provide deterministic routing, state persistence, conditional edges, and human-in-the-loop checkpoints. If the ingestion pipeline fails at step 3 of 5, it resumes from that checkpoint rather than reprocessing from scratch.

The orchestrator handles multi-model routing — each skill uses a model chosen for the task (Qwen for structured extraction and dev-time grounding, Gemma for clean summarization prose, DeepSeek for cross-document reasoning, Command R+ for production RAG scoring). During development, all models are accessed via OpenRouter as a unified API gateway at ~$2.30/month. In production, every selected model is self-hostable via Ollama for zero marginal LLM cost.

### Non-Technical User Composability

Skills are exposed as actions throughout the UI. When viewing any content item, editors can invoke skills directly — summarize an article, extract entities, explain a relevance score — without understanding the underlying pipeline. Results render inline with copy, regenerate, and follow-up actions.

The roadmap progresses from contextual actions (MVP) to multi-step skill chaining (user picks a sequence, output feeds forward) to saved workflow templates that editors can re-run with one click.

### Plugin Architecture for Data Sources

Each data source implements a common interface (`fetch_new_content`, `get_entity_profile`, `health_check`) and handles its own auth and rate limiting. The core system just calls the interface. Planned integrations:

| Source | Purpose | Priority |
| ------ | ------- | -------- |
| RSS | Blog/site tracking for followed entities | Phase 1 |
| Reddit | Trend detection and community sentiment | Phase 1 |
| Resend Inbound | Newsletter email ingestion and authority signals | Phase 2 |
| Bluesky | Entity content tracking (open AT Protocol) | Phase 2 |
| Mastodon | Entity content tracking (ActivityPub) | Phase 3 |
| LinkedIn | Entity enrichment and article discovery | Phase 4 |

### Production-Grade Error Handling

The system is designed for graceful failure, not silent corruption. Unparseable newsletters, ambiguous entity matches, and low-confidence classifications are flagged for human review via a dedicated queue in the UI. Skills return structured error responses. LangGraph nodes implement circuit breakers and max-loop limits. Every skill invocation is logged with model used, latency, confidence, and success/failure status.

## Tech Stack

**Backend:** Django + DRF · Celery + Redis · PostgreSQL · Qdrant (vector DB)

**AI Pipeline:** LangGraph · Claude Skills format · Multi-model via OpenRouter (Llama 3.1, Gemma 3, DeepSeek V3, Qwen 2.5; Command R+ for production) · Ollama for self-hosting · Sentence embeddings

**Frontend:** React · Designed for non-technical editors

**Deployment:** Docker Compose (MVP) · Kubernetes-ready · 12-factor configuration

## Project Documentation

- [Developer Guide](docs/DEVELOPER_GUIDE.md) gives a fast "where to look first" map for new contributors.
- [Deployment Guide](docs/DEPLOYMENT.md) covers Docker Compose, Helm, Minikube, and deployment-aware CI.
- [Implementation Overview](docs/IMPLEMENTATION_OVERVIEW.md) summarizes the main features and current architecture.
- [Data Models](docs/MODELS.md) describes the purpose of each core model.
- [Relevance Scoring](docs/RELEVANCE_SCORING.md) explains how similarity scoring and review thresholds work.
- [Logging](docs/LOGGING.md) explains where application logs go in local and containerized environments.

## Local Development

```bash
python3 -m venv .venv
source .venv/bin/activate
just install
```

`just install` installs the backend and frontend dependencies and registers the repository's `pre-commit` hooks, so `git commit` runs the configured lint and test hooks locally.

There are two intentionally separate workflows:

- `just lint` and `just test` run on the host without Docker. The backend half of those commands uses `.env.test`.
- Runtime, data, and Django management commands run against the Docker Compose stack.

1. Run `just dev` to start Django, Celery, Postgres, Redis, Qdrant, and Nginx. On the first run Docker builds the app image automatically. After that, `just dev` reuses the existing image so normal restarts are fast. If `.env` is missing, the `just` command copies `.env.example` automatically.
2. Run `just build` after changing `requirements.txt` or `docker/web/Dockerfile`. It does not copy or depend on local env files.
3. For a fully fresh local stack after schema changes, run `just reset-volumes` before starting the containers again. This drops the Docker-backed Postgres, Redis, and Qdrant state so regenerated migrations apply cleanly.
4. Run Django management commands against the running backend container. `just migrate`, `just shell`, `just embed-all`, `just embed-project <project_id>`, `just embed-smoke`, `just embed-smoke-content <content_id>`, and `just bootstrap-live-sources <project_id>` all use `docker compose exec django ...`.
5. `.env.example` is Compose-oriented and uses Docker service hostnames for the backend runtime. Update `.env` with non-default secrets before using the stack outside local development.
6. Open `http://localhost:8080/healthz/` for a liveness check and `http://localhost:8080/admin/` for Django admin. Use `just seed` after the stack is up if you want the demo project and sample content.

### Testing

Run the test suite with:

```bash
just test
```

Pytest auto-loads `.env.test` during test startup. That file is intentionally checked in and only contains non-sensitive placeholder values used by tests, such as fake API keys, fake Reddit credentials, and localhost service URLs.

`.env.test` also pins Django tests to an explicit SQLite configuration so backend tests stay independent from the Compose-backed Postgres development database.

`backend-lint` also runs Django-aware host-side checks (`mypy` with the Django plugin and `manage.py check`) under `.env.test`, so `just lint` stays independent from Docker.

Use `.env.test` for stable dummy values that make tests deterministic. Do not put real secrets in it. Real local or production secrets belong in `.env`, which remains ignored.

### Embedding Backends

The embedding layer is provider-based. Configure it with `EMBEDDING_PROVIDER` and `EMBEDDING_MODEL`:

- `sentence-transformers`: loads a Hugging Face / SentenceTransformers model inside the Django process
- `ollama`: calls a local Ollama server for embeddings
- `openrouter`: calls OpenRouter's embeddings API using the configured model id

Common examples:

```dotenv
EMBEDDING_PROVIDER=sentence-transformers
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

```dotenv
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
OLLAMA_URL=http://localhost:11434
```

```dotenv
EMBEDDING_PROVIDER=openrouter
EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_API_KEY=...
OPENROUTER_API_BASE=https://openrouter.ai/api/v1
```

For SentenceTransformers models that require custom remote code, set `EMBEDDING_TRUST_REMOTE_CODE=true`.

### Embedding Commands

Use these commands to backfill or refresh embeddings for existing content:

```bash
just embed-all
just embed-project 1
docker compose exec django python manage.py sync_embeddings --content-id 42
docker compose exec django python manage.py sync_embeddings --references-only
```

When `just dev` is running, Django admin and the developer-facing `just` wrappers all operate against the Compose-backed Postgres database.

Create or update an admin user for the running Docker stack with:

```bash
just createsuperuser
just changepassword your-username
```

For the default local bootstrap, `.env` also seeds an `admin` superuser in the container database using `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`, and `DJANGO_SUPERUSER_PASSWORD`.

## License

This repository is licensed under the GNU Affero General Public License v3.0 or later. See [LICENSE](LICENSE).
