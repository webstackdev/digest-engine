# Newsletter Maker

![Image of AI-powered newsletter workflow](readme.jpg)

An AI-powered content curation platform for technically-oriented newsletters. Newsletter Maker ingests content from dozens of sources, builds authority models of people and companies in a domain, and surfaces the most relevant articles, trends, and themes for each edition — so editors spend their time writing, not searching.

The system is organized into projects: each newsletter project has its own tracked entities, relevance model, and content pipeline. Projects are assigned to Django groups so editorial access can be shared cleanly. Designed for non-technical editors who don't know what a vector database is and don't need to.

## Local Development

Use the repo's `just` commands to get a local stack running:

Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
just install
just build
just dev
just seed
xdg-open http://localhost:8080/
```

macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
just install
just build
just dev
just seed
open http://localhost:8080/
```

Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
just install
just build
just dev
just seed
Start-Process http://localhost:8080/
```

`just build` prepares the backend image and frontend bundle, `just dev` starts the Docker Compose stack, and `just seed` loads demo data into the running app. For the full workflow and troubleshooting notes, see [docs/developer-guide/local-development.md](docs/developer-guide/local-development.md).

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

| Source | Purpose |
| ------ | ------- |
| RSS | Blog/site tracking for followed entities |
| Reddit | Trend detection and community sentiment |
| Resend Inbound | Newsletter email ingestion and authority signals |
| Bluesky | Entity content tracking (open AT Protocol) |
| Mastodon | Entity content tracking (ActivityPub) |
| LinkedIn | Entity enrichment and article discovery |

### Production-Grade Error Handling

The system is designed for graceful failure, not silent corruption. Unparseable newsletters, ambiguous entity matches, and low-confidence classifications are flagged for human review via a dedicated queue in the UI. Skills return structured error responses. LangGraph nodes implement circuit breakers and max-loop limits. Every skill invocation is logged with model used, latency, confidence, and success/failure status.

## Tech Stack

**Backend:** Django + DRF · Celery + Redis · PostgreSQL · Qdrant (vector DB)

**AI Pipeline:** LangGraph · Claude Skills format · Multi-model via OpenRouter (Llama 3.1, Gemma 3, DeepSeek V3, Qwen 2.5; Command R+ for production) · Ollama for self-hosting · Sentence embeddings

**Frontend:** React · Designed for non-technical editors

**Deployment:** Docker Compose (MVP) · Kubernetes-ready · 12-factor configuration

## Project Documentation

Newsletter Maker documentation is organized by audience inside the `docs/` folder:

- [User Guide](docs/user-guide/getting-started-saas.md) covers managing projects, intaking content, and curating drafts.
- [Admin Guide](docs/admin-guide/overview.md) covers installation, configuration, user management, and operational health.
- [Developer Guide](docs/developer-guide/overview.md) covers local workflows, backend/frontend conventions, and testing logic.
- [Reference](docs/reference/data-model.md) details the backend API, algorithms, pipeline definitions, and tunables.

Start at the [Documentation Root](docs/README.md) to navigate to the specific section you need.

## License

This repository is licensed under the GNU Affero General Public License v3.0 or later. See [LICENSE](LICENSE).
