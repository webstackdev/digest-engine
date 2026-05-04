# Troubleshooting

## No Content Appearing
* Check Celery Beat: Are tasks scheduling?
* Check Celery Worker: Are tasks crashing?
* Check `SourceConfig`: Are there active integrations?

## Newsletters Never Confirm
* Ensure `RESEND_API_KEY` is valid.
* Ensure `NEWSLETTER_PUBLIC_URL` is set to an address routing correctly to the Reverse Proxy, or else the generated links in the emails will point to `127.0.0.1` and fail.

## Relevance Scores Near Zero
* If all scores sit at 0.1, the Qdrant `is_reference=True` corpus is either empty or entirely corrupted. Tag at least 5 articles as explicitly "Reference Quality" to set a project boundary.

## Qdrant Search Returns Nothing
* Connect to Qdrant UI mapping on port `6333`. Ensure the collections exist and match the `EMBEDDING_PROVIDER` token sizes. 

## Embeddings Worker Idle
* Double check `OLLAMA_URL` network resolution if running local containers.

## Pipeline Stuck
* Review `SkillResult` tables in Postgres for unhandled tracebacks.

## Messaging Not Delivering
* Ensure Daphne ASGI is handling traffic and isn't overridden by WSGI Gunicorn blocks inside `nginx/conf.d`.
