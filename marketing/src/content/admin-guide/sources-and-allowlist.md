# Sources and Allowlist

Administrators must babysit the influx of content to keep the system healthy.

## Per-Plugin Config
* **RSS**: Relies purely on outbound GET fetches.
* **Reddit / Bluesky / Mastodon**: Relies entirely on their respective API limitations. If you hit 429 Too Many Requests, throttle the polling intervals.

## Health Check Semantics
Plugins record timestamped failures into `IngestionRun`. If an ingestion source fails 5 times consecutively, the frontend highlights it in red.

## Bootstrap Live Sources
You can instantly seed a fresh database with:
```bash
docker compose exec django python manage.py bootstrap_live_sources
```

## Intake Allowlist Lifecycle
When you forward a newsletter to your ingest address:
1. `Pending`: The system receives the email but quarantines it.
2. `Confirmation Sent`: The system emails the sender back with a one-time link.
3. `Confirmed`: The user clicks the link. Their address is now Trusted.
4. `Expired`: Stalled after 7 days.

## Revoking Senders
If a newsletter breaks or creates spam, remove it via the Django Admin panel under `newsletters.IntakeAllowlist`.

## Investigating Dropped Subscriptions
Check the `NewsletterIntake` model in Django admin. Emails that fail to parse HTML correctly record their Stack Traces there.
