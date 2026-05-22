import datetime
from typing import Any

from ninja import Path, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status

from core.ninja_api import api_authenticate
from projects.models import BlueskyCredentials, LinkedInCredentials, MastodonCredentials
from projects.ninja_helpers import _get_project_or_404, _require_project_admin

bluesky_router = Router(tags=["Bluesky Credentials"])


class BlueskyCredentialsSchema(Schema):
    id: int
    project: int
    handle: str
    pds_url: str
    is_active: bool
    has_stored_credential: bool
    last_verified_at: datetime.datetime | str | None = None
    last_error: str | None = None
    created_at: datetime.datetime | str | None = None
    updated_at: datetime.datetime | str | None = None


class BlueskyCredentialsCreateInput(Schema):
    handle: str
    pds_url: str = "https://bsky.social"
    is_active: bool = True
    app_password: str | None = None


class BlueskyCredentialsUpdateInput(Schema):
    handle: str | None = None
    pds_url: str | None = None
    is_active: bool | None = None
    app_password: str | None = None


def _serialize_bluesky(cred: BlueskyCredentials) -> dict[str, Any]:
    return {
        "id": int(cred.pk),
        "project": cred.project_id,
        "handle": cred.handle,
        "pds_url": cred.pds_url,
        "is_active": cred.is_active,
        "has_stored_credential": cred.has_stored_credential(),
        "last_verified_at": cred.last_verified_at,
        "last_error": cred.last_error,
        "created_at": cred.created_at,
        "updated_at": cred.updated_at,
    }


def _get_bluesky_or_404(project_id: int, cred_id: int) -> BlueskyCredentials:
    cred = BlueskyCredentials.objects.filter(project_id=project_id, pk=cred_id).first()
    if not cred:
        raise HttpError(404, "Not found.")
    return cred


@bluesky_router.get("/", response=list[BlueskyCredentialsSchema], auth=api_authenticate)
def list_bluesky(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    creds = BlueskyCredentials.objects.filter(project_id=project_id).order_by(
        "-updated_at"
    )
    return [_serialize_bluesky(c) for c in creds]


@bluesky_router.post(
    "/",
    response={201: BlueskyCredentialsSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def create_bluesky(
    request, payload: BlueskyCredentialsCreateInput, project_id: int = Path(...)
):
    project = _require_project_admin(request, project_id)
    app_password = payload.app_password or ""
    if not app_password:
        return Status(400, {"app_password": ["A Bluesky app credential is required."]})
    cred = BlueskyCredentials.objects.create(
        project=project,
        handle=payload.handle,
        pds_url=payload.pds_url,
        is_active=payload.is_active,
    )
    cred.set_app_password(app_password)
    cred.save(update_fields=["app_password_encrypted", "updated_at"])
    return Status(201, _serialize_bluesky(cred))


@bluesky_router.get(
    "/{cred_id}/", response=BlueskyCredentialsSchema, auth=api_authenticate
)
def get_bluesky(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    cred = _get_bluesky_or_404(project_id, cred_id)
    return _serialize_bluesky(cred)


@bluesky_router.patch(
    "/{cred_id}/",
    response={200: BlueskyCredentialsSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_bluesky(
    request,
    payload: BlueskyCredentialsUpdateInput,
    project_id: int = Path(...),
    cred_id: int = Path(...),
):
    _require_project_admin(request, project_id)
    cred = _get_bluesky_or_404(project_id, cred_id)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "handle" in updates:
        cred.handle = updates["handle"]
    if "pds_url" in updates:
        cred.pds_url = updates["pds_url"]
    if "is_active" in updates:
        cred.is_active = updates["is_active"]
    if "app_password" in updates and updates["app_password"]:
        cred.set_app_password(updates["app_password"])
    cred.save()
    return _serialize_bluesky(cred)


@bluesky_router.delete("/{cred_id}/", response={204: None}, auth=api_authenticate)
def delete_bluesky(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _require_project_admin(request, project_id)
    cred = _get_bluesky_or_404(project_id, cred_id)
    cred.delete()
    return Status(204, None)


mastodon_router = Router(tags=["Mastodon Credentials"])


class MastodonCredentialsSchema(Schema):
    id: int
    project: int
    instance_url: str
    account_acct: str
    is_active: bool
    has_stored_credential: bool
    last_verified_at: datetime.datetime | str | None = None
    last_error: str | None = None
    created_at: datetime.datetime | str | None = None
    updated_at: datetime.datetime | str | None = None


class MastodonCredentialsCreateInput(Schema):
    instance_url: str
    account_acct: str
    is_active: bool = True
    access_token: str | None = None


class MastodonCredentialsUpdateInput(Schema):
    instance_url: str | None = None
    account_acct: str | None = None
    is_active: bool | None = None
    access_token: str | None = None


def _serialize_mastodon(cred: MastodonCredentials) -> dict[str, Any]:
    return {
        "id": int(cred.pk),
        "project": cred.project_id,
        "instance_url": cred.instance_url,
        "account_acct": cred.account_acct,
        "is_active": cred.is_active,
        "has_stored_credential": cred.has_stored_credential(),
        "last_verified_at": cred.last_verified_at,
        "last_error": cred.last_error,
        "created_at": cred.created_at,
        "updated_at": cred.updated_at,
    }


def _get_mastodon_or_404(project_id: int, cred_id: int) -> MastodonCredentials:
    cred = MastodonCredentials.objects.filter(project_id=project_id, pk=cred_id).first()
    if not cred:
        raise HttpError(404, "Not found.")
    return cred


@mastodon_router.get(
    "/", response=list[MastodonCredentialsSchema], auth=api_authenticate
)
def list_mastodon(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    creds = MastodonCredentials.objects.filter(project_id=project_id).order_by(
        "-updated_at"
    )
    return [_serialize_mastodon(c) for c in creds]


@mastodon_router.post(
    "/",
    response={201: MastodonCredentialsSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def create_mastodon(
    request, payload: MastodonCredentialsCreateInput, project_id: int = Path(...)
):
    project = _require_project_admin(request, project_id)
    access_token = payload.access_token or ""
    if not access_token:
        return Status(400, {"access_token": ["A Mastodon access token is required."]})
    cred = MastodonCredentials.objects.create(
        project=project,
        instance_url=payload.instance_url,
        account_acct=payload.account_acct,
        is_active=payload.is_active,
    )
    cred.set_access_token(access_token)
    cred.save(update_fields=["access_token_encrypted", "updated_at"])
    return Status(201, _serialize_mastodon(cred))


@mastodon_router.get(
    "/{cred_id}/", response=MastodonCredentialsSchema, auth=api_authenticate
)
def get_mastodon(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    cred = _get_mastodon_or_404(project_id, cred_id)
    return _serialize_mastodon(cred)


@mastodon_router.patch(
    "/{cred_id}/",
    response={200: MastodonCredentialsSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_mastodon(
    request,
    payload: MastodonCredentialsUpdateInput,
    project_id: int = Path(...),
    cred_id: int = Path(...),
):
    _require_project_admin(request, project_id)
    cred = _get_mastodon_or_404(project_id, cred_id)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "instance_url" in updates:
        cred.instance_url = updates["instance_url"]
    if "account_acct" in updates:
        cred.account_acct = updates["account_acct"]
    if "is_active" in updates:
        cred.is_active = updates["is_active"]
    if "access_token" in updates and updates["access_token"]:
        cred.set_access_token(updates["access_token"])
    cred.save()
    return _serialize_mastodon(cred)


@mastodon_router.delete("/{cred_id}/", response={204: None}, auth=api_authenticate)
def delete_mastodon(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _require_project_admin(request, project_id)
    cred = _get_mastodon_or_404(project_id, cred_id)
    cred.delete()
    return Status(204, None)


linkedin_router = Router(tags=["LinkedIn Credentials"])


class LinkedInCredentialsSchema(Schema):
    id: int
    project: int
    member_urn: str
    expires_at: datetime.datetime | str | None = None
    is_active: bool
    has_stored_credential: bool
    last_verified_at: datetime.datetime | str | None = None
    last_error: str | None = None
    created_at: datetime.datetime | str | None = None
    updated_at: datetime.datetime | str | None = None


class LinkedInCredentialsCreateInput(Schema):
    member_urn: str
    is_active: bool = True
    access_token: str | None = None
    refresh_token: str | None = None


class LinkedInCredentialsUpdateInput(Schema):
    member_urn: str | None = None
    is_active: bool | None = None
    access_token: str | None = None
    refresh_token: str | None = None


def _serialize_linkedin(cred: LinkedInCredentials) -> dict[str, Any]:
    return {
        "id": int(cred.pk),
        "project": cred.project_id,
        "member_urn": cred.member_urn,
        "expires_at": cred.expires_at,
        "is_active": cred.is_active,
        "has_stored_credential": cred.has_stored_credential(),
        "last_verified_at": cred.last_verified_at,
        "last_error": cred.last_error,
        "created_at": cred.created_at,
        "updated_at": cred.updated_at,
    }


def _get_linkedin_or_404(project_id: int, cred_id: int) -> LinkedInCredentials:
    cred = LinkedInCredentials.objects.filter(project_id=project_id, pk=cred_id).first()
    if not cred:
        raise HttpError(404, "Not found.")
    return cred


@linkedin_router.get(
    "/", response=list[LinkedInCredentialsSchema], auth=api_authenticate
)
def list_linkedin(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    creds = LinkedInCredentials.objects.filter(project_id=project_id).order_by(
        "-updated_at"
    )
    return [_serialize_linkedin(c) for c in creds]


@linkedin_router.post(
    "/",
    response={201: LinkedInCredentialsSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def create_linkedin(
    request, payload: LinkedInCredentialsCreateInput, project_id: int = Path(...)
):
    project = _require_project_admin(request, project_id)
    access_token = payload.access_token or ""
    refresh_token = payload.refresh_token or ""
    if not access_token:
        return Status(400, {"access_token": ["A LinkedIn access token is required."]})
    if not refresh_token:
        return Status(400, {"refresh_token": ["A LinkedIn refresh token is required."]})
    cred = LinkedInCredentials.objects.create(
        project=project,
        member_urn=payload.member_urn,
        is_active=payload.is_active,
    )
    cred.set_access_token(access_token)
    cred.set_refresh_token(refresh_token)
    cred.save(
        update_fields=[
            "access_token_encrypted",
            "refresh_token_encrypted",
            "updated_at",
        ]
    )
    return Status(201, _serialize_linkedin(cred))


@linkedin_router.get(
    "/{cred_id}/", response=LinkedInCredentialsSchema, auth=api_authenticate
)
def get_linkedin(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    cred = _get_linkedin_or_404(project_id, cred_id)
    return _serialize_linkedin(cred)


@linkedin_router.patch(
    "/{cred_id}/",
    response={200: LinkedInCredentialsSchema, 400: dict[str, list[str]]},
    auth=api_authenticate,
)
def update_linkedin(
    request,
    payload: LinkedInCredentialsUpdateInput,
    project_id: int = Path(...),
    cred_id: int = Path(...),
):
    _require_project_admin(request, project_id)
    cred = _get_linkedin_or_404(project_id, cred_id)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "member_urn" in updates:
        cred.member_urn = updates["member_urn"]
    if "is_active" in updates:
        cred.is_active = updates["is_active"]
    if "access_token" in updates and updates["access_token"]:
        cred.set_access_token(updates["access_token"])
    if "refresh_token" in updates and updates["refresh_token"]:
        cred.set_refresh_token(updates["refresh_token"])
    cred.save()
    return _serialize_linkedin(cred)


@linkedin_router.delete("/{cred_id}/", response={204: None}, auth=api_authenticate)
def delete_linkedin(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _require_project_admin(request, project_id)
    cred = _get_linkedin_or_404(project_id, cred_id)
    cred.delete()
    return Status(204, None)
