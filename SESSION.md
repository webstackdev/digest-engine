# Session Restore Point

## Branch

- Working branch: `maintenance/refactor-to-ninja`

## Implementation

### DRF Removal Checklist

- [ ] Make Ninja the only public API surface.
- [ ] Switch the canonical `/api/v1/` routes in `digest_engine/urls.py` away from `users.api_urls` and `core.api_urls` so the runtime no longer depends on DRF routers.
- [ ] Collapse the temporary parallel `/api/ninja/v1/` migration surface into the final `/api/v1/` surface once route parity is complete.
- [ ] Port the remaining DRF-only route slice in `pipeline/api.py` to Ninja.
- [ ] Remove the legacy DRF route modules once their Ninja replacements are canonical:
  - `users/api.py`
  - `notifications/api.py`
  - `messaging/api.py`
  - `projects/api.py`
  - `content/api.py`
  - `ingestion/api.py`
  - `entities/api.py`
  - `newsletters/api.py`
  - `pipeline/api.py`
  - `trends/api.py`
- [ ] Remove the DRF router registration modules after cutover:
  - `core/api_urls.py`
  - `projects/api_urls.py`
  - `content/api_urls.py`
  - `ingestion/api_urls.py`
  - `entities/api_urls.py`
  - `newsletters/api_urls.py`
  - `pipeline/api_urls.py`
  - `trends/api_urls.py`
  - `notifications/api_urls.py`
  - `messaging/api_urls.py`
  - `users/api_urls.py`

### Native Schemas And Validation

- [x] Replace DRF serializer usage in `trends/ninja_api.py` with native Ninja request/response schemas and explicit validation helpers.
- [ ] Use the `trends` conversion as the pattern for the rest of the Ninja modules that still depend on DRF serializers.
- [ ] Replace DRF serializer usage in these Ninja modules:
  - `users/ninja_api.py`
  - `projects/ninja_api.py`
  - `projects/ninja_project_configs_api.py`
  - `projects/ninja_memberships_api.py`
  - `projects/ninja_invitations_api.py`
  - `projects/ninja_source_configs_api.py`
  - `projects/ninja_credentials_api.py`
  - `content/ninja_api.py`
  - `ingestion/ninja_api.py`
  - `entities/ninja_api.py`
  - `newsletters/ninja_api.py`
  - `messaging/ninja_api.py`
  - `notifications/ninja_api.py`
  - `trends/ninja_api.py`
- [ ] Replace shared DRF serializer infrastructure in `core/serializer_mixins.py` and stop depending on `ProjectScopedSerializerMixin`.
- [ ] Retire or replace the DRF serializer modules once their logic is represented by Ninja schemas or plain helper functions:
  - `users/serializers.py`
  - `projects/serializers.py`
  - `content/serializers.py`
  - `entities/serializers.py`
  - `ingestion/serializers.py`
  - `newsletters/serializers.py`
  - `messaging/serializers.py`
  - `notifications/serializers.py`
  - `pipeline/serializers.py`
  - `trends/serializers.py`
- [ ] Replace DRF exceptions and status constants still imported by Ninja modules with native Ninja, Django, or standard-library equivalents.

### Auth, Permissions, And Error Handling

- [ ] Replace the DRF-backed auth bridge in `core/ninja_api.py` so Ninja no longer depends on `rest_framework.request.Request`, `api_settings`, or DRF authenticators.
- [ ] Replace `register_drf_exception_handlers` in `core/ninja_api.py` with native Ninja exception mapping.
- [ ] Replace the DRF permission classes in `core/permissions.py` with plain authorization helpers or Ninja-native permission wiring.
- [ ] Preserve the current auth behavior the frontend relies on without DRF:
  - authenticated browser session access
  - any remaining token-based API access that is still required
  - any remaining basic-auth behavior that is intentionally supported
- [ ] Replace the `dj-rest-auth` auth endpoints currently mounted in `digest_engine/urls.py`.
- [ ] Replace the DRF-based social login views in `core/auth_views.py` (`SocialLoginView`, `AllowAny`) with a non-DRF implementation.
- [ ] Remove `rest_framework.authtoken` usage from settings and runtime once the replacement auth path is in place.

### Schema, Docs, And Shared DRF Helpers

- [ ] Replace `drf-spectacular` schema generation and Swagger wiring with Ninja OpenAPI/docs.
- [ ] Remove DRF schema/error settings from `digest_engine/settings/base.py` and `digest_engine/settings/swagger.py`.
- [ ] Remove DRF-specific schema helper code in `core/api.py` once no DRF viewsets remain.
- [ ] Re-home any reusable response examples or schema metadata currently encoded through DRF helpers if they are still needed after the switch.

### Tests And Validation

- [ ] Replace DRF test helpers in the Ninja tests (`rest_framework.test.APIClient`, `APITestCase`, `rest_framework.status`) with Django test utilities and standard HTTP status constants.
- [ ] Remove the legacy DRF API test modules after the equivalent Ninja coverage is canonical:
  - `users/tests/test_profile_api.py`
  - `projects/tests/test_api.py`
  - `projects/tests/test_invitations.py`
  - `content/tests/test_api.py`
  - `ingestion/tests/test_api.py`
  - `entities/tests/test_api.py`
  - `newsletters/tests/test_api.py`
  - `notifications/tests/test_api.py`
  - `messaging/tests/test_api.py`
  - `trends/tests/test_api.py`
  - `core/tests/test_api.py`
  - any remaining DRF-only endpoint coverage in `core/tests/test_permissions.py`
- [ ] Replace `core/tests/test_serializers.py` with tests for the new native schema/validation layer or delete it if the coverage becomes obsolete.
- [ ] Keep focused validation green as each removal step lands:
  - affected Ninja API tests
  - any auth-flow tests impacted by the `dj-rest-auth` replacement
  - `python manage.py check`

### Settings, Apps, And Dependency Cleanup

- [ ] Remove DRF apps and settings from `digest_engine/settings/base.py` when the runtime no longer needs them:
  - `rest_framework`
  - `rest_framework.authtoken`
  - `dj_rest_auth`
  - `dj_rest_auth.registration`
  - `REST_FRAMEWORK`
  - `DRF_STANDARDIZED_ERRORS`
- [ ] Remove DRF-specific URL wiring from `digest_engine/urls.py`:
  - `SpectacularAPIView`
  - `SpectacularSwaggerView`
  - `dj_rest_auth.urls`
  - `dj_rest_auth.registration.urls`
- [ ] Remove the DRF package dependencies from `pyproject.toml` and `uv.lock`:
  - `djangorestframework`
  - `drf-nested-routers`
  - `drf-spectacular`
  - `drf-standardized-errors`
  - `dj-rest-auth`
- [ ] Audit and remove DRF-adjacent packages if they are no longer needed after the cutover:
  - `djangorestframework-simplejwt`
  - `djangochannelsrestframework`
- [ ] Run one final repo-wide search for `rest_framework`, `drf_spectacular`, `drf_standardized_errors`, `dj_rest_auth`, and `NestedSimpleRouter` before removing the dependency.

## Where We Left Off

- Added `django-ninja` to the backend dependency set in `pyproject.toml` and `uv.lock`.
- Added shared Ninja helpers in `core/ninja_api.py`:
  - DRF-compatible authentication bridge via `drf_authenticate`
  - DRF exception passthrough via `register_drf_exception_handlers`
- Added a parallel Ninja API registry in `digest_engine/ninja_api.py`.
- Mounted the parallel Ninja API in `digest_engine/urls.py` at `/api/ninja/`.
- Ported the root-level user-scoped API surface to function-based Ninja:
  - `users/ninja_api.py`
  - `notifications/ninja_api.py`
  - `messaging/ninja_api.py`
- Added focused Ninja tests for those slices:
  - `users/tests/test_ninja_profile_api.py`
  - `notifications/tests/test_ninja_api.py`
  - `messaging/tests/test_ninja_api.py`
- Ported the root `projects` API endpoints and project-level custom actions to `projects/ninja_api.py`.
  - Added project list, retrieve, create, update, delete functionality
  - Ported `rotate-intake-token` action
  - Ported custom actions for verifying external credentials and starting auth flows
- Added tests for `projects` Ninja API functionality in `projects/tests/test_ninja_api.py`.
- Designed the reusable Ninja pattern for nested project-scoped routes by leveraging Ninja's native `{project_id}` path parameter injection to nested sub-routers (documented at the bottom of `projects/ninja_api.py`).
- Ported the `content` nested API surface to function-based Ninja:
  - `content/ninja_api.py`
  - mounted `contents` and `feedback` under `projects/ninja_api.py`
- Added focused Ninja tests for the content slice:
  - `content/tests/test_ninja_api.py`
- Ported the `ingestion` nested API surface to function-based Ninja:
  - `ingestion/ninja_api.py`
  - mounted `ingestion-runs` under `projects/ninja_api.py`
- Added focused Ninja tests for the ingestion slice:
  - `ingestion/tests/test_ninja_api.py`
- Ported the `entities` nested API surface to function-based Ninja:
  - `entities/ninja_api.py`
  - mounted `entities` and `entity-candidates` under `projects/ninja_api.py`
- Added focused Ninja tests for the entities slice:
  - `entities/tests/test_ninja_api.py`
- Ported the `newsletters` nested API surface to function-based Ninja:
  - `newsletters/ninja_api.py`
  - mounted `intake-allowlist`, `newsletter-intakes`, `drafts`, `draft-sections`, `draft-items`, and `draft-original-pieces` under `projects/ninja_api.py`
- Added focused Ninja tests for the newsletters slice:
  - `newsletters/tests/test_ninja_api.py`
- Ported the `trends` nested API surface to function-based Ninja:
  - `trends/ninja_api.py`
  - mounted `clusters`, `themes`, `ideas`, `topic-centroid-snapshots`, `source-diversity-snapshots`, and `trend-task-runs` under `projects/ninja_api.py`
- Added focused Ninja tests for the trends slice:
  - `trends/tests/test_ninja_api.py`
- Clarified a migration risk after the trends port:
  - many Ninja handlers still reuse DRF serializers for validation and response rendering
  - endpoint migration to Ninja is not yet equivalent to removing DRF from the runtime

## Current API Shape

- The existing DRF API is still the canonical surface under `/api/v1/`.
- The new function-based Ninja surface is available in parallel under `/api/ninja/v1/`.
- The Ninja surface currently covers:
  - current-user profile endpoints
  - invitation token endpoints
  - notifications endpoints
  - messaging thread/message endpoints
  - project-scoped content endpoints
  - project-scoped feedback endpoints
  - project-scoped ingestion run endpoints
  - project-scoped entity endpoints
  - project-scoped entity candidate endpoints
  - project-scoped newsletter allowlist endpoints
  - project-scoped newsletter intake endpoints
  - project-scoped newsletter draft endpoints
  - project-scoped newsletter draft subtree endpoints
  - project-scoped trends endpoints (`clusters`, `themes`, `ideas`)
  - project-scoped trend observability endpoints (`topic-centroid-snapshots`, `source-diversity-snapshots`, `trend-task-runs`)
- Important nuance:
  - most of the Ninja surface still depends on DRF serializer modules in `users/serializers.py`, `projects/serializers.py`, `content/serializers.py`, `entities/serializers.py`, `ingestion/serializers.py`, `newsletters/serializers.py`, `messaging/serializers.py`, `notifications/serializers.py`, and `pipeline/serializers.py`
  - `trends/ninja_api.py` is now the first native Ninja-schema slice and no longer imports `trends/serializers.py`
  - the only remaining app-owned API slice that is still DRF-only at the route layer is `pipeline/api.py`

## Validation Status

- Last successful checks this session:
  - `pytest projects/tests/test_ninja_api.py` and other ninja API tests.
  - `pytest content/tests/test_ninja_api.py`
  - `pytest ingestion/tests/test_ninja_api.py`
  - `pytest entities/tests/test_ninja_api.py`
  - `pytest newsletters/tests/test_ninja_api.py`
  - `pytest trends/tests/test_ninja_api.py`
  - `python manage.py check`

## Important Constraints

- We are migrating incrementally, not cutting DRF over in one step.
- The auth bridge in `core/ninja_api.py` is important because the frontend still relies on the backend accepting the current DRF auth modes.
- The goal is function-based Ninja endpoints, but payload shapes and auth behavior should stay compatible with the current frontend.
- Endpoint parity is only the first half of the migration.
- To actually remove DRF, we still need to replace DRF serializers, DRF request/auth integration, DRF routers, DRF schema/docs plumbing, and DRF-based tests.

## Next Scope

- First move:
  - stop introducing new Ninja routes that depend on DRF serializers
  - reuse the completed native `trends` slice as the reference pattern for the remaining serializer-backed Ninja modules
- Why `trends` mattered as the pilot:
  - it exercises the full set of migration patterns we need next: read-only list/detail payloads, workflow actions, request validation, and computed summary responses
  - it now gives us a concrete native Ninja pattern before touching broader slices like newsletters or entities
- Immediate follow-on after native `trends` schemas:
  - port `pipeline/api.py` to Ninja so no app-owned project route still depends on DRF viewsets
  - replace DRF serializer usage in the remaining Ninja modules, starting with high-traffic project-scoped slices
  - then replace shared DRF runtime bridges in `core/ninja_api.py`, `core/api_urls.py`, `digest_engine/urls.py`, and `digest_engine/settings/base.py`

## Suggested Next Plan

- [x] Port `trends` nested routes to Ninja.
- [x] Add focused tests for `trends` Ninja routes.
- [x] Replace DRF serializer usage inside `trends/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [ ] Use the `trends` refactor as the pattern for other Ninja modules that still import app DRF serializers.
- [ ] Port `pipeline/api.py` to Ninja.
- [ ] Remove DRF router registration from `core/api_urls.py` once all route slices have Ninja replacements.
- [ ] Replace the DRF auth/exception bridge in `core/ninja_api.py` with non-DRF authentication and error handling.

## Working Tree Notes

- There are current local changes beyond the new Ninja files:
  - `digest_engine/urls.py`
  - `pyproject.toml`
  - `projects/ninja_api.py`
  - `trends/ninja_api.py`
  - `trends/tests/test_ninja_api.py`
  - `uv.lock`
  - `.vscode/settings.json`
- Treat `.vscode/settings.json` as local/editor state unless there is a specific reason to touch it.
