# Configuration

See the [Tunables Reference](../reference/tunables.md) for the exact list of algorithms and thresholds.

## Required vs Optional Variables
**Required**: 
* `DATABASE_URL`, `REDIS_URL`, `QDRANT_URL`, `SECRET_KEY`, `NEWSLETTER_API_BASE_URL`.
**Optional but critical for AI**:
* `OPENROUTER_API_KEY` (Required for relevance tie-breaking and categorization).

## Secrets Handling
* In Docker Compose: Loaded tightly from the `.env` file mapped securely to the container.
* In Kubernetes: Expected to be mapped into the Pod `env` spec via Secrets.

## Internal vs Public URLs
Due to container networking:
* `NEWSLETTER_API_BASE_URL` (Internal) will reference inner hostnames like `http://nginx`.
* `NEWSLETTER_PUBLIC_URL` (Public) should point to your real FQDN (e.g. `https://news.mydomain.com`) used in emails.

## Email Provider (Anymail)
Newsletter intake relies on Resend webhooks and Django Anymail forwarding.
Configured via:
* `RESEND_API_KEY`
* `RESEND_INBOUND_SECRET`
* `DEFAULT_FROM_EMAIL`

## LLM Provider Routing
Select between `local`, `ollama` or remote providers using `EMBEDDING_PROVIDER`. Set URLs correctly to point to either the internal container (`http://ollama:11434`) or external APIs (`https://api.openai.com/v1`).

## OAuth Provider Toggles
If `LINKEDIN_CLIENT_ID` or `REDDIT_CLIENT_ID` are present, their respective capabilities light up dynamically in the application.
