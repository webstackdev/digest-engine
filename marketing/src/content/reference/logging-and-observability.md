# Logging and Observability

Because pipelines run silently in the background via Celery and LangGraph, strong observability is required to debug node failures, bad LLM parses, and data pipeline locks.

## Structured Log Format
We mandate structured logging via library (e.g., `structlog`) to emit `JSON` locally and in production.
Required standard fields:
* `project_id`: Present whenever logging within the context of a project.
* `content_id`: Present when acting on a specific ingested item.

## Trace/Correlation IDs
Celery tasks and Django requests inject a correlation ID into the log context, providing the ability to stitch together an `IngestionRun` that spawned a task, which invoked a LangGraph `PipelineRun`, which hit an OpenRouter error.

## Prometheus Metrics Exposed
When Helm/Kubernetes deployments activate the `ServiceMonitor`, we expose:
* `django_http_requests_total`
* `django_http_requests_latency_seconds`
* `celery_task_status_total`
* `ai_skill_invocation_total` (Labeled by skill name and model)

*Metrics enablement requires `METRICS_TOKEN` authentication on the scraping endpoint.*

## Dashboards
In Kubernetes setups, Grafana dashboards attach to Prometheus data sources. Look for:
- API Latency & Error Rates
- Celery Queue Depth & Worker Saturation
- LLM Token Costs & Skill Reliability

## Retention Windows
Since raw telemetry can overwhelm DBs quickly, the application enforces automated pruning of its internal audit models based on defaults set in [Tunables](tunables.md):
- `OBSERVABILITY_SNAPSHOT_RETENTION_DAYS` (90 days)
- `OBSERVABILITY_TREND_TASK_RUN_RETENTION_DAYS` (30 days)
- `OBSERVABILITY_REVIEW_QUEUE_RETENTION_DAYS` (30 days)

## How to Add a New Log/Metric
Always fetch the bound logger instance initialized at the module level rather than calling `logging.info()` directly.
When logging errors for a pipeline node, pass the `payload` kwargs so the JSON log payload has exactly what the LLM received.
