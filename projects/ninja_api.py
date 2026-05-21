"""Django Ninja endpoints for project-owned resources."""

from __future__ import annotations

import datetime
from typing import Any, cast

from ninja import Router, Schema
from ninja.errors import HttpError
from rest_framework import serializers

from core.api import logger
from core.ninja_api import drf_authenticate
from core.permissions import get_visible_projects_queryset
from ingestion.plugins.bluesky import BlueskySourcePlugin
from ingestion.plugins.linkedin import LinkedInSourcePlugin
from ingestion.plugins.mastodon import MastodonSourcePlugin
from projects.linkedin_oauth import build_linkedin_authorize_url
from projects.models import (
    BlueskyCredentials,
    LinkedInCredentials,
    MastodonCredentials,
    Project,
    ProjectMembership,
    ProjectRole,
    generate_project_intake_token,
)
from projects.serializers import ProjectSerializer

router = Router(tags=["Project Management"])


class ProjectSchema(Schema):
    """Serialized project payload."""

    id: int
    name: str
    topic_description: str
    content_retention_days: int
    intake_token: str
    intake_enabled: bool
    user_role: str | None = None
    has_bluesky_credentials: bool
    bluesky_handle: str | None = None
    bluesky_is_active: bool
    bluesky_last_verified_at: datetime.datetime | None = None
    bluesky_last_error: str | None = None
    created_at: datetime.datetime


class ProjectCreateInput(Schema):
    """Editable fields accepted by the project create endpoint."""

    name: str
    topic_description: str
    content_retention_days: int = 90
    intake_enabled: bool = True


class ProjectUpdateInput(Schema):
    """Editable fields accepted by the project update endpoint."""

    name: str | None = None
    topic_description: str | None = None
    content_retention_days: int | None = None
    intake_enabled: bool | None = None


class BlueskyCredentialsVerifyResponse(Schema):
    status: str
    handle: str
    last_verified_at: datetime.datetime | None
    last_error: str


class LinkedInOAuthStartRequest(Schema):
    redirect_to: str | None = None


class LinkedInOAuthStartResponse(Schema):
    authorize_url: str


class LinkedInCredentialsVerifyResponse(Schema):
    status: str
    member_urn: str
    expires_at: datetime.datetime | None
    last_verified_at: datetime.datetime | None
    last_error: str


class MastodonCredentialsVerifyResponse(Schema):
    status: str
    account_acct: str
    instance_url: str
    last_verified_at: datetime.datetime | None
    last_error: str


def _serialize_project(project: Project, request: Any = None) -> dict[str, Any]:
    """Return the project response body."""
    context = {"request": request} if request else {}
    return cast(dict[str, Any], ProjectSerializer(project, context=context).data)


def _get_project_or_404(request: Any, project_id: int) -> Project:
    """Load one project if the authenticated user has access."""
    project = (
        get_visible_projects_queryset(request.user)
        .filter(id=project_id)
        .select_related("bluesky_credentials")
        .first()
    )
    if not project:
        raise HttpError(404, "Not found.")
    return project


def _require_project_writable(request: Any, project_id: int) -> Project:
    """Load one project, requiring admin or member (write) access."""
    project = _get_project_or_404(request, project_id)
    membership = ProjectMembership.objects.filter(
        project=project, user=request.user
    ).first()
    if not membership or membership.role not in {ProjectRole.ADMIN, ProjectRole.MEMBER}:
        raise HttpError(403, "You do not have permission to perform this action.")
    return project


def _require_project_admin(request: Any, project_id: int) -> Project:
    """Load one project, requiring admin access."""
    project = _get_project_or_404(request, project_id)
    membership = ProjectMembership.objects.filter(
        project=project, user=request.user
    ).first()
    if not membership or membership.role != ProjectRole.ADMIN:
        raise HttpError(403, "You do not have permission to perform this action.")
    return project


@router.get("/projects/", response=list[ProjectSchema], auth=drf_authenticate)
def list_projects(request):
    """Return accessible projects for the authenticated user."""
    projects = get_visible_projects_queryset(request.user).select_related(
        "bluesky_credentials"
    )
    return [_serialize_project(project, request) for project in projects]


@router.post("/projects/", response={201: ProjectSchema}, auth=drf_authenticate)
def create_project(request, payload: ProjectCreateInput):
    """Create a new project for the authenticated user."""
    serializer = ProjectSerializer(
        data=payload.model_dump(exclude_unset=True), context={"request": request}
    )
    serializer.is_valid(raise_exception=True)
    project = serializer.save()
    ProjectMembership.objects.create(
        user=request.user,
        project=project,
        role=ProjectRole.ADMIN,
    )
    return 201, _serialize_project(project, request)


@router.get("/projects/{project_id}/", response=ProjectSchema, auth=drf_authenticate)
def get_project(request, project_id: int):
    """Return project details."""
    project = _get_project_or_404(request, project_id)
    return _serialize_project(project, request)


@router.patch("/projects/{project_id}/", response=ProjectSchema, auth=drf_authenticate)
def update_project(request, project_id: int, payload: ProjectUpdateInput):
    """Update project details."""
    project = _require_project_admin(request, project_id)
    serializer = ProjectSerializer(
        project,
        data=payload.model_dump(exclude_unset=True),
        partial=True,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_project(project, request)


@router.delete("/projects/{project_id}/", response={204: None}, auth=drf_authenticate)
def delete_project(request, project_id: int):
    """Delete a project."""
    project = _require_project_admin(request, project_id)
    project.delete()
    return 204, None


@router.post(
    "/projects/{project_id}/rotate-intake-token/",
    response=ProjectSchema,
    auth=drf_authenticate,
)
def rotate_intake_token(request, project_id: int):
    """Generate a fresh intake token for the selected project."""
    project = _require_project_admin(request, project_id)
    project.intake_token = generate_project_intake_token()
    project.save(update_fields=["intake_token"])
    return _serialize_project(project, request)


@router.post(
    "/projects/{project_id}/verify-bluesky-credentials/",
    response=BlueskyCredentialsVerifyResponse,
    auth=drf_authenticate,
)
def verify_bluesky_credentials(request, project_id: int):
    """Verify the Bluesky credentials stored for the selected project."""
    project = _require_project_admin(request, project_id)
    try:
        credentials = project.bluesky_credentials
    except BlueskyCredentials.DoesNotExist as exc:
        raise serializers.ValidationError(
            {
                "bluesky_credentials": "No Bluesky credentials are configured for this project."
            }
        ) from exc

    try:
        BlueskySourcePlugin.verify_credentials(credentials)
    except Exception as exc:
        logger.exception(
            "Bluesky credential verification failed for project id=%s", project.id
        )
        raise serializers.ValidationError(
            {
                "bluesky_credentials": "Credential verification failed. Please re-check the credentials and try again."
            }
        ) from exc

    credentials.refresh_from_db()
    return {
        "status": "verified",
        "handle": credentials.handle,
        "last_verified_at": credentials.last_verified_at,
        "last_error": credentials.last_error or "",
    }


@router.post(
    "/projects/{project_id}/start-linkedin-oauth/",
    response=LinkedInOAuthStartResponse,
    auth=drf_authenticate,
)
def start_linkedin_oauth(request, project_id: int, payload: LinkedInOAuthStartRequest):
    """Return the LinkedIn OAuth authorization URL for the selected project."""
    project = _require_project_admin(request, project_id)
    authorize_url = build_linkedin_authorize_url(
        project,
        payload.redirect_to,
    )
    return {"authorize_url": authorize_url}


@router.post(
    "/projects/{project_id}/verify-linkedin-credentials/",
    response=LinkedInCredentialsVerifyResponse,
    auth=drf_authenticate,
)
def verify_linkedin_credentials(request, project_id: int):
    """Verify the LinkedIn credentials stored for the selected project."""
    project = _require_project_admin(request, project_id)
    try:
        credentials = project.linkedin_credentials
    except LinkedInCredentials.DoesNotExist as exc:
        raise serializers.ValidationError(
            {
                "linkedin_credentials": "No LinkedIn credentials are configured for this project."
            }
        ) from exc

    try:
        LinkedInSourcePlugin.verify_credentials(credentials)
    except Exception as exc:
        logger.exception(
            "LinkedIn credential verification failed for project id=%s", project.id
        )
        raise serializers.ValidationError(
            {
                "linkedin_credentials": "Credential verification failed. Please re-check the credentials and try again."
            }
        ) from exc

    credentials.refresh_from_db()
    return {
        "status": "verified",
        "member_urn": credentials.member_urn,
        "expires_at": credentials.expires_at,
        "last_verified_at": credentials.last_verified_at,
        "last_error": credentials.last_error or "",
    }


@router.post(
    "/projects/{project_id}/verify-mastodon-credentials/",
    response=MastodonCredentialsVerifyResponse,
    auth=drf_authenticate,
)
def verify_mastodon_credentials(request, project_id: int):
    """Verify the Mastodon credentials stored for the selected project."""
    project = _require_project_admin(request, project_id)
    try:
        credentials = project.mastodon_credentials
    except MastodonCredentials.DoesNotExist as exc:
        raise serializers.ValidationError(
            {
                "mastodon_credentials": "No Mastodon credentials are configured for this project."
            }
        ) from exc

    try:
        MastodonSourcePlugin.verify_credentials(credentials)
    except Exception as exc:
        logger.exception(
            "Mastodon credential verification failed for project id=%s", project.id
        )
        raise serializers.ValidationError(
            {
                "mastodon_credentials": "Credential verification failed. Please re-check the credentials and try again."
            }
        ) from exc

    credentials.refresh_from_db()
    return {
        "status": "verified",
        "account_acct": credentials.account_acct,
        "instance_url": credentials.instance_url,
        "last_verified_at": credentials.last_verified_at,
        "last_error": credentials.last_error or "",
    }


__all__ = ["router"]

# ==============================================================================
# Nested /projects/{project_id}/... Router Pattern
# ==============================================================================
# Ninja handles nested routes natively by injecting Path parameters (e.g. `project_id`)
# into sub-router endpoints. Modules owning nested project resources (like
# memberships or source_configs) should define their own Router instances.
#
# Pattern usage:
# ```python
# from ninja import Router
# from projects.ninja_api import _require_project_admin, _get_project_or_404
#
# project_configs_router = Router(tags=["Project Configurations"])
#
# @project_configs_router.get("/", auth=drf_authenticate)
# def list_configs(request, project_id: int):
#     project = _get_project_or_404(request, project_id)
#     ...
# ```
#
# Then attach it here to the main project_router:
# `router.add_router("/{project_id}/project-configs", project_configs_router)`
from projects.ninja_project_configs_api import router as project_configs_router
from projects.ninja_memberships_api import router as project_memberships_router
from projects.ninja_invitations_api import router as project_invitations_router
from projects.ninja_source_configs_api import router as source_configs_router
from projects.ninja_credentials_api import (
    bluesky_router,
    mastodon_router,
    linkedin_router,
)
from content.ninja_api import content_router, feedback_router
from ingestion.ninja_api import router as ingestion_runs_router
from entities.ninja_api import entity_candidate_router, entity_router
from newsletters.ninja_api import (
    intake_allowlist_router,
    newsletter_draft_items_router,
    newsletter_draft_original_pieces_router,
    newsletter_draft_sections_router,
    newsletter_drafts_router,
    newsletter_intakes_router,
)
from trends.ninja_api import (
    clusters_router,
    ideas_router,
    source_diversity_snapshots_router,
    themes_router,
    topic_centroid_snapshots_router,
    trend_task_runs_router,
)

router.add_router("/projects/{project_id}/project-configs", project_configs_router)
router.add_router("/projects/{project_id}/memberships", project_memberships_router)
router.add_router("/projects/{project_id}/invitations", project_invitations_router)
router.add_router("/projects/{project_id}/source-configs", source_configs_router)
router.add_router("/projects/{project_id}/bluesky-credentials", bluesky_router)
router.add_router("/projects/{project_id}/mastodon-credentials", mastodon_router)
router.add_router("/projects/{project_id}/linkedin-credentials", linkedin_router)
router.add_router("/projects/{project_id}/contents", content_router)
router.add_router("/projects/{project_id}/feedback", feedback_router)
router.add_router("/projects/{project_id}/ingestion-runs", ingestion_runs_router)
router.add_router("/projects/{project_id}/entities", entity_router)
router.add_router("/projects/{project_id}/entity-candidates", entity_candidate_router)
router.add_router("/projects/{project_id}/intake-allowlist", intake_allowlist_router)
router.add_router(
    "/projects/{project_id}/newsletter-intakes", newsletter_intakes_router
)
router.add_router("/projects/{project_id}/drafts", newsletter_drafts_router)
router.add_router(
    "/projects/{project_id}/draft-sections", newsletter_draft_sections_router
)
router.add_router("/projects/{project_id}/draft-items", newsletter_draft_items_router)
router.add_router(
    "/projects/{project_id}/draft-original-pieces",
    newsletter_draft_original_pieces_router,
)
router.add_router("/projects/{project_id}/clusters", clusters_router)
router.add_router("/projects/{project_id}/themes", themes_router)
router.add_router("/projects/{project_id}/ideas", ideas_router)
router.add_router(
    "/projects/{project_id}/topic-centroid-snapshots",
    topic_centroid_snapshots_router,
)
router.add_router(
    "/projects/{project_id}/source-diversity-snapshots",
    source_diversity_snapshots_router,
)
router.add_router("/projects/{project_id}/trend-task-runs", trend_task_runs_router)
