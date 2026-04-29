# Session Restore Point

## 2026-04-29 End Of Day

- WP4 entity extraction is implemented end-to-end.
- Backend added `EntityMention` and `EntityCandidate`, migration `core/migrations/0006_entitycandidate_entitymention.py`, new `core/entity_extraction.py`, and an `extract_entities` pipeline node between classification and relevance.
- Admin now supports reviewing entity candidates and mentions; candidate accept/reject/merge actions are wired in `core/admin.py`.
- API/frontend work is in place for entity mention summaries, project-scoped entity candidate review actions, and the new entity detail page at `frontend/src/app/entities/[id]/page.tsx`.
- `/entities` now shows pending candidates plus recent mention summaries, and links into the entity detail page.
- Focused validation that passed today:
	- `pytest core/tests/test_pipeline.py core/tests/test_admin.py -q`
	- `pytest core/tests/test_api.py -q`
	- `python manage.py check`
	- `python manage.py makemigrations --check --dry-run`
	- `python3 -m mypy core/pipeline.py core/entity_extraction.py core/embeddings.py core/models.py core/admin.py core/tests/test_pipeline.py core/tests/test_admin.py`
	- `cd frontend && npm run typecheck`
	- `cd frontend && npm run lint`
	- `cd frontend && npx vitest run src/app/entities/__tests__/page.test.tsx src/app/api/entity-candidates/[id]/__tests__/route.test.ts src/app/entities/[id]/__tests__/page.test.tsx`
- Repo-wide `just lint` was rerun after fixing `frontend/src/lib/api.ts` import ordering; backend lint fully passed and direct frontend lint now passes with `FRONTEND_LINT_OK`.



## Useful Commands From Today

```bash
docker run --rm newsletter-maker-app:dev python -c "import drf_standardized_errors; print('ok')"
docker compose exec django python -c "import drf_standardized_errors; print('ok')"
docker compose exec django pip show drf-standardized-errors
docker inspect newsletter-maker-django-1 --format '{{.Id}} {{.Image}} {{.Config.Image}}'
docker inspect newsletter-maker-django-1 --format '{{json .Mounts}}'
pytest core/tests/test_embeddings.py -q
ruff check core/management/commands/seed_demo.py core/tests/test_embeddings.py
```
