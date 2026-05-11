# Backups and Retention

## Postgres Backup
Back up Postgres using standard `pg_dump`:
```bash
docker compose exec postgres pg_dump -U newsletter digest_engine > backup.sql
```

## Qdrant Snapshot
Qdrant manages internal snapshots. See Qdrant Snapshot API documentation for exporting raw vector archives. Otherwise, vector data can be entirely reconstructed from Postgres text if necessary (though it costs API tokens to recalculate).

## Observability Retention Windows
To prevent unbound DB growth, old logs and task runs are deleted according to:
- `OBSERVABILITY_SNAPSHOT_RETENTION_DAYS` (default 90)
- `OBSERVABILITY_TREND_TASK_RUN_RETENTION_DAYS` (default 30)

## Restore Drill
To restore the platform:
1. `docker compose down -v`
2. Restore Postgres DB volume.
3. Bring system up. (If Qdrant is empty, trigger an embedding backfill from Postgres text).
