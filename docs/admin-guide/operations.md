# Operations

## Daily/Weekly Health Checks
* Check Celery Beat logs to see if scheduled ticks are executing.
* Look for `429 Too Many Requests` in your API provider logs (OpenRouter).

## Celery Beat & Worker Monitoring
Use Celery Flower (if enabled in Compose) or monitor queue depth in Redis length.

## Qdrant Collection Health
Ensure Qdrant is snapshotting to disk and not constantly OOM-killed. If it runs out of memory, increase VPS limits.

## Embeddings Backfill
If you switch embedding providers (e.g., moving from `local` to `openai`), previous cosine scores are invalidated. You must run a backfill management command to rewrite all `Content` vectors.

## Re-running Pipeline
If LLM failures occurred due to an outage:
Go to Django Admin -> `PipelineRun` -> select failed items and re-trigger.

## Clearing Stuck Items
Use the `ReviewQueue` in the Next.js frontend to clear items the LLM had zero confidence about.

## Messaging/Channels Health
If real-time notifications fail, verify Daphne is alive and the `REDIS_URL` matches the Channels configuration.
