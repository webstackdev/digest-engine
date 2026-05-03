#!/usr/bin/env bash
set -euo pipefail

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_env() {
  if [[ -z "${!1:-}" ]]; then
    echo "Required environment variable is not set: $1" >&2
    exit 1
  fi
}

require_command curl
require_command kubectl
require_command pg_dump

require_env STAGING_NAMESPACE
require_env STAGING_DJANGO_DEPLOYMENT
require_env STAGING_CELERY_DEPLOYMENT
require_env STAGING_POSTGRES_URL
require_env QDRANT_SNAPSHOT_URL

output_root="${DR_OUTPUT_DIR:-var/disaster-recovery-rehearsal}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="${output_root}/${timestamp}"
mkdir -p "$run_dir"

echo "Writing disaster recovery rehearsal artifacts to $run_dir"

pg_dump \
  --format=custom \
  --file "$run_dir/staging-postgres.pgdump" \
  "$STAGING_POSTGRES_URL"

snapshot_headers=()
if [[ -n "${QDRANT_SNAPSHOT_API_KEY:-}" ]]; then
  snapshot_headers=(-H "api-key: ${QDRANT_SNAPSHOT_API_KEY}")
fi

curl -fsS -X POST "${snapshot_headers[@]}" "$QDRANT_SNAPSHOT_URL" \
  | tee "$run_dir/qdrant-snapshot.json"

kubectl rollout status \
  "deployment/${STAGING_DJANGO_DEPLOYMENT}" \
  -n "$STAGING_NAMESPACE" \
  --timeout=180s \
  | tee "$run_dir/django-rollout.txt"

kubectl rollout status \
  "deployment/${STAGING_CELERY_DEPLOYMENT}" \
  -n "$STAGING_NAMESPACE" \
  --timeout=180s \
  | tee "$run_dir/celery-rollout.txt"

kubectl get pods -n "$STAGING_NAMESPACE" -o wide > "$run_dir/pods.txt"
kubectl get jobs -n "$STAGING_NAMESPACE" > "$run_dir/jobs.txt"

cat <<EOF
Disaster recovery rehearsal completed.
Artifacts:
- PostgreSQL backup: $run_dir/staging-postgres.pgdump
- Qdrant snapshot response: $run_dir/qdrant-snapshot.json
- Django rollout status: $run_dir/django-rollout.txt
- Celery rollout status: $run_dir/celery-rollout.txt
- Pod inventory: $run_dir/pods.txt
- Job inventory: $run_dir/jobs.txt
EOF
