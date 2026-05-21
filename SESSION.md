# Session Restore Point

## Branch

- Working branch: `maintenance/refactor-to-ninja`

## Implementation

### DRF Removal Checklist

- [ ] Make Ninja the only public API surface.
- [x] Switch the canonical `/api/v1/` routes in `digest_engine/urls.py` away from `users.api_urls` and `core.api_urls` so the runtime no longer depends on DRF routers.
- [ ] Collapse the temporary parallel `/api/ninja/v1/` migration surface into the final `/api/v1/` surface once route parity is complete.
- [x] Port the remaining DRF-only route slice in `pipeline/api.py` to Ninja.
- [ ] Remove the legacy DRF route modules once their Ninja replacements are canonical:
  - `ingestion/api.py`
  - `entities/api.py`
  - `newsletters/api.py`
  - `trends/api.py`
- [x] Remove the DRF router registration modules after cutover:
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
- [x] Use the `trends` conversion as the pattern for the rest of the Ninja modules that still depend on DRF serializers.
- [x] Replace DRF serializer usage in the remaining app Ninja modules so `*_ninja_api.py` no longer imports app DRF serializers.
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
- [x] Replace DRF exceptions and status constants still imported by Ninja modules with native Ninja, Django, or standard-library equivalents.

### Auth, Permissions, And Error Handling

- [x] Replace the DRF-backed auth bridge in `core/ninja_api.py` so Ninja no longer depends on `rest_framework.request.Request`, `api_settings`, or DRF authenticators.
- [x] Replace `register_drf_exception_handlers` in `core/ninja_api.py` with native Ninja exception mapping.
- [x] Replace the DRF permission classes in `core/permissions.py` with plain authorization helpers or Ninja-native permission wiring.
- [ ] Preserve the current auth behavior the frontend relies on without DRF:
  - authenticated browser session access
  - any remaining token-based API access that is still required
  - any remaining basic-auth behavior that is intentionally supported
- [x] Replace the `dj-rest-auth` auth endpoints previously mounted in `digest_engine/urls.py`.
- [x] Replace the DRF-based social login views in `core/auth_views.py` (`SocialLoginView`, `AllowAny`) with a non-DRF implementation.
- [x] Replace the `dj-rest-auth` registration endpoint mounted in `digest_engine/urls.py` with a non-DRF implementation.
- [x] Replace the `dj-rest-auth` logout and user-details endpoints mounted in `digest_engine/urls.py` with non-DRF implementations.
- [x] Replace the remaining `dj-rest-auth` password endpoints mounted in `digest_engine/urls.py` with non-DRF implementations.
- [x] Remove `rest_framework.authtoken` usage from settings and runtime once the replacement auth path is in place.

### Schema, Docs, And Shared DRF Helpers

- [ ] Replace `drf-spectacular` schema generation and Swagger wiring with Ninja OpenAPI/docs.
- [ ] Remove DRF schema/error settings from `digest_engine/settings/base.py` and `digest_engine/settings/swagger.py`.
- [ ] Remove DRF-specific schema helper code in `core/api.py` once no DRF viewsets remain.
- [ ] Re-home any reusable response examples or schema metadata currently encoded through DRF helpers if they are still needed after the switch.

### Tests And Validation

- [ ] Replace DRF test helpers in the Ninja tests (`rest_framework.test.APIClient`, `APITestCase`, `rest_framework.status`) with Django test utilities and standard HTTP status constants.
- [ ] Remove the legacy DRF API test modules after the equivalent Ninja coverage is canonical:
  - `ingestion/tests/test_api.py`
  - `entities/tests/test_api.py`
  - `newsletters/tests/test_api.py`
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
- Replaced the shared Ninja auth bridge in `core/ninja_api.py` with native session, token, and basic-auth handling, so Ninja no longer depends on DRF request/authenticator classes.
- Extended the shared Ninja auth bridge in `core/ninja_api.py` to accept Bearer JWTs through SimpleJWT validation without reviving the old DRF request bridge.
- Removed DRF APIException registration from `digest_engine/ninja_api.py` because the current Ninja surface no longer raises DRF exceptions.
- Reworked `core/permissions.py` so project-role helpers and permission objects no longer import DRF, while preserving the permission interface the remaining DRF viewsets still consume.
- Updated the frontend API helper in `frontend/src/lib/api.ts` to use bearer JWT auth when the session exposes backend credentials and otherwise fall back directly to Basic auth, removing the last `backendAuth.key` transport path.
- Added a non-DRF credentials login view at `/api/auth/login/` that accepts username or email, establishes a Django session, and returns JWT access/refresh tokens.
- Added a non-DRF registration view at `/api/auth/registration/` that creates the user, persists the allauth email record, establishes a Django session, and returns JWT access/refresh tokens.
- Added non-DRF logout and user-details views at `/api/auth/logout/` and `/api/auth/user/`, preserving the legacy logout success payload and the legacy `pk`/`username`/`email`/`first_name`/`last_name` user-details shape while authenticating through the shared non-DRF auth bridge.
- Added non-DRF password reset, password reset confirm, and password change views at `/api/auth/password/reset/`, `/api/auth/password/reset/confirm/`, and `/api/auth/password/change/`, preserving the legacy success messages while dropping the final `dj_rest_auth.urls` dependency.
- Replaced the DRF-backed GitHub and Google social login views in `core/auth_views.py` with plain Django views that accept provider access tokens, establish a Django session, and return JWT access/refresh tokens.
- Removed `dj_rest_auth.registration` from `INSTALLED_APPS` and replaced the `dj_rest_auth.registration.urls` include with the native registration view.
- Removed `dj_rest_auth` from `INSTALLED_APPS` and removed the final `dj_rest_auth.urls` include from `digest_engine/urls.py`.
- Removed the legacy `Token` auth fallback from `core/ninja_api.py`, removed `rest_framework.authtoken` from `digest_engine/settings/base.py`, and deleted the remaining focused token-auth regression coverage that only existed for that fallback.
- Converted `users/tests/test_ninja_profile_api.py` from DRF `APIClient` and `rest_framework.status` helpers to Django `Client` and standard `HTTPStatus` constants.
- Added a parallel Ninja API registry in `digest_engine/ninja_api.py`.
- Mounted the parallel Ninja API in `digest_engine/urls.py` at `/api/ninja/`.
- Cut the canonical `/api/v1/` runtime over to Django Ninja in `digest_engine/urls.py`, removing the `users.api_urls` and `core.api_urls` runtime includes.
- Preserved `/api/v1/linkedin/oauth/callback/` as a standalone URL include so `reverse("v1:linkedin-oauth-callback")` still works without the old DRF router module.
- Split the temporary `/api/ninja/` alias onto its own `legacy-ninja-api` namespace so the canonical `ninja-api` reverse names now point at `/api/v1/...` without duplicate-namespace warnings.
- Deleted the now-unused DRF router registration modules in `core/api_urls.py`, `users/api_urls.py`, and the app-level `api_urls.py` files because no runtime path or repo code still imported them after the cutover.
- Replaced the last live DRF serializer usage in `notifications/realtime.py` with a native payload helper and deleted the dead DRF notifications API, serializer, and legacy DRF API test files.
- Deleted the dead DRF messaging API, serializer, and legacy DRF API test files.
- Deleted the dead DRF users API module and the redundant legacy DRF profile API test file.
- Split the still-relevant LinkedIn OAuth helper and callback coverage out of `projects/tests/test_api.py` into `projects/tests/test_linkedin_oauth.py`, then deleted the dead DRF `projects/api.py` module and the legacy DRF `projects/tests/test_api.py` and `projects/tests/test_invitations.py` files.
- Inlined the content skill-name constants into `content/ninja_api.py`, then deleted the dead DRF `content/api.py` module and `content/tests/test_api.py`.
- Deleted the dead DRF `pipeline/api.py` module.
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
- Replaced DRF serializer usage in the top-level `projects/ninja_api.py` routes with native Ninja validation and serialization helpers.
- Replaced DRF serializer usage in `projects/ninja_credentials_api.py` with native Ninja validation, serialization, and secret-persistence helpers.
- Replaced DRF serializer usage in `projects/ninja_source_configs_api.py` with native Ninja validation, serialization, and plugin-config normalization helpers.
- Replaced DRF serializer usage in `projects/ninja_project_configs_api.py` with native Ninja validation, serialization, and cron normalization helpers.
- Replaced DRF serializer usage in `projects/ninja_memberships_api.py` with native Ninja validation, serialization, and admin-retention helpers.
- Replaced DRF serializer usage in `projects/ninja_invitations_api.py` with native Ninja validation, serialization, and invitation-email helpers.
- Replaced DRF serializer usage in `content/ninja_api.py` with native Ninja validation, serialization, and project-owned content/feedback helpers.
- Replaced DRF serializer usage in `ingestion/ninja_api.py` with native Ninja validation, serialization, and model-backed ingestion-run helpers.
- Replaced DRF serializer usage in `entities/ninja_api.py` with native Ninja validation, serialization, and entity-candidate merge helpers.
- Replaced DRF serializer usage in `notifications/ninja_api.py` with native Ninja serialization helpers.
- Replaced DRF serializer usage in `messaging/ninja_api.py` with native Ninja validation and serialization helpers for thread and message workflows.
- Replaced DRF serializer usage in `users/ninja_api.py` with native Ninja validation and serialization helpers for profile updates, avatar uploads, and invitation acceptance.
- Replaced DRF serializer usage in `newsletters/ninja_api.py` with native Ninja validation and serialization helpers for allowlists, drafts, draft subtree edits, and section regeneration.
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
- Ported the `pipeline` nested API surface to function-based Ninja:
  - `pipeline/ninja_api.py`
  - mounted `skill-results` and `review-queue` under `projects/ninja_api.py`
- Added focused Ninja tests for the pipeline slice:
  - `pipeline/tests/test_ninja_api.py`
- Clarified a migration risk after the trends port:
  - many Ninja handlers still reuse DRF serializers for validation and response rendering
  - endpoint migration to Ninja is not yet equivalent to removing DRF from the runtime

## Current API Shape

- The canonical public API surface is now the function-based Ninja registry under `/api/v1/`.
- The temporary migration alias still exists in parallel under `/api/ninja/v1/`.
- The only intentional non-Ninja route still living under `/api/v1/` is `/api/v1/linkedin/oauth/callback/`, which remains as a small standalone URL include so the existing LinkedIn OAuth callback reverse name keeps working.
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
  - no current `*_ninja_api.py` module imports app DRF serializers anymore; the remaining DRF work is now shared infrastructure, auth/error handling, router cutover, test helpers, and dependency removal
  - the Ninja runtime no longer depends on `rest_framework.request.Request`, DRF authenticators, or DRF `APIException` handling; it now accepts session, bearer, and basic auth directly
  - `core/permissions.py` no longer imports DRF; the remaining permission-related DRF work is in legacy DRF viewsets and router cutover rather than the shared role helpers used by Ninja
  - the top-level `projects/ninja_api.py` routes plus `projects/ninja_credentials_api.py`, `projects/ninja_source_configs_api.py`, `projects/ninja_project_configs_api.py`, `projects/ninja_memberships_api.py`, `projects/ninja_invitations_api.py`, `users/ninja_api.py`, and `newsletters/ninja_api.py` no longer import DRF serializers
  - `content/ninja_api.py` now uses native Ninja-side validation/serialization helpers and no longer imports `content/serializers.py` or `pipeline/serializers.py`
  - `ingestion/ninja_api.py` now uses native Ninja-side validation/serialization helpers and no longer imports `ingestion/serializers.py`
  - `entities/ninja_api.py` now uses native Ninja-side validation/serialization helpers and no longer imports `entities/serializers.py`
  - `notifications/ninja_api.py` now uses native Ninja-side serialization helpers and the legacy `notifications/serializers.py` / `notifications/api.py` slice has been removed
  - `messaging/ninja_api.py` now uses native Ninja-side validation/serialization helpers and the legacy `messaging/serializers.py` / `messaging/api.py` slice has been removed
  - `users/ninja_api.py` now uses native Ninja-side validation/serialization helpers and the legacy `users/api.py` slice has been removed
  - `projects/ninja_api.py` and the nested `projects/ninja_*_api.py` modules are now the only live project API surface; the legacy `projects/api.py` slice has been removed
  - `content/ninja_api.py` now owns the content skill-name constants it needs and the legacy `content/api.py` slice has been removed
  - `pipeline/ninja_api.py` is now the only live pipeline route layer; the legacy `pipeline/api.py` slice has been removed
  - `newsletters/ninja_api.py` now uses native Ninja-side validation/serialization helpers and no longer imports `newsletters/serializers.py`
  - `trends/ninja_api.py` is now the first native Ninja-schema slice and no longer imports `trends/serializers.py`
  - `pipeline/ninja_api.py` now covers the former DRF-only `skill-results` and `review-queue` route layer, but it still coexists with the legacy DRF endpoints until cutover

## Validation Status

- Last successful checks this session:
  - `pytest core/tests/test_auth_views.py`
  - `pytest core/tests/test_permissions.py`
  - `pytest users/tests/test_auth_views.py`
  - `pytest users/tests/test_ninja_profile_api.py`
  - `pytest projects/tests/test_ninja_api.py`
  - `pytest projects/tests/test_ninja_credentials_api.py`
  - `pytest projects/tests/test_ninja_source_configs_api.py`
  - `pytest projects/tests/test_ninja_project_configs_api.py`
  - `pytest projects/tests/test_ninja_memberships_api.py`
  - `pytest projects/tests/test_ninja_invitations_api.py`
  - `pytest projects/tests/test_linkedin_oauth.py`
  - `pytest content/tests/test_ninja_api.py`
  - `pytest ingestion/tests/test_ninja_api.py`
  - `pytest entities/tests/test_ninja_api.py`
  - `pytest notifications/tests/test_ninja_api.py`
  - `pytest notifications/tests/test_signals.py notifications/tests/test_consumer.py notifications/tests/test_emit.py`
  - `pytest messaging/tests/test_ninja_api.py`
  - `pytest messaging/tests/test_signals.py`
  - `pytest newsletters/tests/test_ninja_api.py`
  - `pytest trends/tests/test_ninja_api.py`
  - `pytest pipeline/tests/test_ninja_api.py`
  - `pytest projects/tests/test_api.py -k 'build_linkedin_authorize_url_uses_configured_scopes or linkedin_oauth_callback_persists_project_credentials'`
  - `python manage.py check`
  - `cd frontend && npm run test:run -- src/lib/__tests__/api.test.ts`
  - `cd frontend && npm run test:run -- src/lib/__tests__/auth.test.ts`

- Newly covered by focused Ninja auth tests:
  - credentials login at `POST /api/auth/login/` with username
  - credentials login at `POST /api/auth/login/` with email
  - registration at `POST /api/auth/registration/`
  - JWT access token from `POST /api/auth/registration/` authorizes `GET /api/v1/profile/`
  - logout at `POST /api/auth/logout/`
  - user details at `GET /api/auth/user/` via bearer auth
  - user details update at `PATCH /api/auth/user/`
  - password reset at `POST /api/auth/password/reset/`
  - password reset confirm at `POST /api/auth/password/reset/confirm/`
  - password change at `POST /api/auth/password/change/`
  - social login at `POST /api/auth/github/`
  - social login at `POST /api/auth/google/`
  - JWT access token from `POST /api/auth/login/` authorizes `GET /api/v1/profile/`
  - session-auth access on `GET /api/ninja/v1/profile/`
  - bearer-auth access on `GET /api/ninja/v1/profile/`
  - basic-auth access on `GET /api/ninja/v1/profile/`

## Important Constraints

- The canonical router cutover is complete, but the migration is still incremental because `/api/ninja/v1/` remains as a temporary alias while we finish cleanup.
- The auth bridge in `core/ninja_api.py` is important because the frontend still relies on the backend accepting the current DRF auth modes.
- The goal is function-based Ninja endpoints, but payload shapes and auth behavior should stay compatible with the current frontend.
- Endpoint parity is only the first half of the migration.
- To actually remove DRF, we still need to remove serializer infrastructure that only serves the old DRF surface, replace the remaining DRF-based tests and schema/docs plumbing, and then drop the leftover DRF packages from the dependency set.

## Next Scope

- First move:
  - remove the remaining DRF serializer infrastructure and serializer modules that no longer serve any runtime API
  - keep the temporary `/api/ninja/v1/` alias only until the remaining reverse-name and parity cleanup is complete
- Immediate follow-on after canonical cutover:
  - replace shared DRF serializer infrastructure in `core/serializer_mixins.py` and retire the app serializer modules that no longer feed any runtime API
  - continue replacing DRF test helpers in the remaining Ninja test files, using `users/tests/test_ninja_profile_api.py` as the Django-client reference pattern
  - remove the legacy DRF API tests and schema/settings wiring once the remaining coverage has native equivalents

## Suggested Next Plan

- [x] Port `trends` nested routes to Ninja.
- [x] Add focused tests for `trends` Ninja routes.
- [x] Replace DRF serializer usage inside `trends/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Port `pipeline/api.py` to Ninja.
- [x] Replace DRF serializer usage inside `projects/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `projects/ninja_credentials_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `projects/ninja_source_configs_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `projects/ninja_project_configs_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `projects/ninja_memberships_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `projects/ninja_invitations_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `content/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `ingestion/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `entities/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `notifications/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `messaging/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `users/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Replace DRF serializer usage inside `newsletters/ninja_api.py` with native Ninja schemas and explicit validation helpers.
- [x] Use the `trends` refactor as the pattern for other Ninja modules that still import app DRF serializers.
- [x] Replace the DRF auth bridge and DRF exception passthrough in `core/ninja_api.py` with native Ninja-compatible behavior.
- [x] Remove the DRF import from `core/permissions.py` while preserving the shared project-role permission interface.
- [x] Replace the credentials login endpoint at `/api/auth/login/` with a non-DRF JWT response.
- [x] Replace the registration endpoint at `/api/auth/registration/` with a non-DRF JWT response.
- [x] Replace the logout and user-details endpoints at `/api/auth/logout/` and `/api/auth/user/` with non-DRF responses.
- [x] Replace the password reset, password reset confirm, and password change endpoints at `/api/auth/password/reset/`, `/api/auth/password/reset/confirm/`, and `/api/auth/password/change/` with non-DRF responses.
- [x] Replace the DRF-backed social login endpoints at `/api/auth/github/` and `/api/auth/google/` with non-DRF JWT responses.
- [x] Remove the legacy `Token` fallback path from the shared auth bridge, frontend transport, and runtime settings.
- [x] Cut over the legacy DRF router wiring so `/api/v1/` now resolves through the Ninja registry.
- [x] Remove the now-unused DRF router registration modules (`core/api_urls.py`, `users/api_urls.py`, and the app-level `api_urls.py` files that only served the old DRF surface).
- [x] Remove the legacy DRF notifications, messaging, and users route modules where the canonical Ninja replacements already cover the same behavior.
- [x] Remove the legacy DRF notifications, messaging, and users API test modules where the canonical Ninja coverage already exists.
- [x] Remove the legacy DRF projects, content, and pipeline route modules where the canonical Ninja replacements already cover the same behavior.
- [x] Remove the legacy DRF projects and content API test modules where the canonical Ninja coverage already exists, while preserving the LinkedIn OAuth helper coverage in a dedicated test file.
- [ ] Replace DRF test helpers in the remaining Ninja test files.
- [ ] Remove the remaining legacy DRF API test modules once the native Ninja coverage is the canonical source of truth.
- [ ] Replace `drf-spectacular` and the remaining DRF schema/error settings with Ninja-native API docs and settings.

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
