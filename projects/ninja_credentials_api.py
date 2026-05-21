from typing import Any, cast
import datetime

from ninja import Router, Schema, Path
from ninja.errors import HttpError

from core.ninja_api import drf_authenticate
from projects.ninja_api import _require_project_admin, _get_project_or_404
from projects.models import BlueskyCredentials, MastodonCredentials, LinkedInCredentials
from projects.serializers import (
    BlueskyCredentialsSerializer,
    MastodonCredentialsSerializer,
    LinkedInCredentialsSerializer,
)

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
    return cast(dict[str, Any], BlueskyCredentialsSerializer(cred).data)


def _get_bluesky_or_404(project_id: int, cred_id: int) -> BlueskyCredentials:
    cred = BlueskyCredentials.objects.filter(project_id=project_id, pk=cred_id).first()
    if not cred:
        raise HttpError(404, "Not found.")
    return cred


@bluesky_router.get("/", response=list[BlueskyCredentialsSchema], auth=drf_authenticate)
def list_bluesky(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    creds = BlueskyCredentials.objects.filter(project_id=project_id).order_by(
        "-updated_at"
    )
    return [_serialize_bluesky(c) for c in creds]


@bluesky_router.post(
    "/", response={201: BlueskyCredentialsSchema}, auth=drf_authenticate
)
def create_bluesky(
    request, payload: BlueskyCredentialsCreateInput, project_id: int = Path(...)
):
    project = _require_project_admin(request, project_id)
    serializer = BlueskyCredentialsSerializer(
        data=payload.model_dump(exclude_unset=True, exclude_none=True),
        context={"project": project},
    )
    serializer.is_valid(raise_exception=True)
    cred = serializer.save(project=project)
    return 201, _serialize_bluesky(cred)


@bluesky_router.get(
    "/{cred_id}/", response=BlueskyCredentialsSchema, auth=drf_authenticate
)
def get_bluesky(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    cred = _get_bluesky_or_404(project_id, cred_id)
    return _serialize_bluesky(cred)


@bluesky_router.patch(
    "/{cred_id}/", response=BlueskyCredentialsSchema, auth=drf_authenticate
)
def update_bluesky(
    request,
    payload: BlueskyCredentialsUpdateInput,
    project_id: int = Path(...),
    cred_id: int = Path(...),
):
    _require_project_admin(request, project_id)
    cred = _get_bluesky_or_404(project_id, cred_id)
    serializer = BlueskyCredentialsSerializer(
        cred,
        data=payload.model_dump(exclude_unset=True, exclude_none=True),
        partial=True,
        context={"project": cred.project},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_bluesky(cred)


@bluesky_router.delete("/{cred_id}/", response={204: None}, auth=drf_authenticate)
def delete_bluesky(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _require_project_admin(request, project_id)
    cred = _get_bluesky_or_404(project_id, cred_id)
    cred.delete()
    return 204, None


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
    return cast(dict[str, Any], MastodonCredentialsSerializer(cred).data)


def _get_mastodon_or_404(project_id: int, cred_id: int) -> MastodonCredentials:
    cred = MastodonCredentials.objects.filter(project_id=project_id, pk=cred_id).first()
    if not cred:
        raise HttpError(404, "Not found.")
    return cred


@mastodon_router.get(
    "/", response=list[MastodonCredentialsSchema], auth=drf_authenticate
)
def list_mastodon(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    creds = MastodonCredentials.objects.filter(project_id=project_id).order_by(
        "-updated_at"
    )
    return [_serialize_mastodon(c) for c in creds]


@mastodon_router.post(
    "/", response={201: MastodonCredentialsSchema}, auth=drf_authenticate
)
def create_mastodon(
    request, payload: MastodonCredentialsCreateInput, project_id: int = Path(...)
):
    project = _require_project_admin(request, project_id)
    serializer = MastodonCredentialsSerializer(
        data=payload.model_dump(exclude_unset=True, exclude_none=True),
        context={"project": project},
    )
    serializer.is_valid(raise_exception=True)
    cred = serializer.save(project=project)
    return 201, _serialize_mastodon(cred)


@mastodon_router.get(
    "/{cred_id}/", response=MastodonCredentialsSchema, auth=drf_authenticate
)
def get_mastodon(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    cred = _get_mastodon_or_404(project_id, cred_id)
    return _serialize_mastodon(cred)


@mastodon_router.patch(
    "/{cred_id}/", response=MastodonCredentialsSchema, auth=drf_authenticate
)
def update_mastodon(
    request,
    payload: MastodonCredentialsUpdateInput,
    project_id: int = Path(...),
    cred_id: int = Path(...),
):
    _require_project_admin(request, project_id)
    cred = _get_mastodon_or_404(project_id, cred_id)
    serializer = MastodonCredentialsSerializer(
        cred,
        data=payload.model_dump(exclude_unset=True, exclude_none=True),
        partial=True,
        context={"project": cred.project},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_mastodon(cred)


@mastodon_router.delete("/{cred_id}/", response={204: None}, auth=drf_authenticate)
def delete_mastodon(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _require_project_admin(request, project_id)
    cred = _get_mastodon_or_404(project_id, cred_id)
    cred.delete()
    return 204, None


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
    return cast(dict[str, Any], LinkedInCredentialsSerializer(cred).data)


def _get_linkedin_or_404(project_id: int, cred_id: int) -> LinkedInCredentials:
    cred = LinkedInCredentials.objects.filter(project_id=project_id, pk=cred_id).first()
    if not cred:
        raise HttpError(404, "Not found.")
    return cred


@linkedin_router.get(
    "/", response=list[LinkedInCredentialsSchema], auth=drf_authenticate
)
def list_linkedin(request, project_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    creds = LinkedInCredentials.objects.filter(project_id=project_id).order_by(
        "-updated_at"
    )
    return [_serialize_linkedin(c) for c in creds]


@linkedin_router.post(
    "/", response={201: LinkedInCredentialsSchema}, auth=drf_authenticate
)
def create_linkedin(
    request, payload: LinkedInCredentialsCreateInput, project_id: int = Path(...)
):
    project = _require_project_admin(request, project_id)
    serializer = LinkedInCredentialsSerializer(
        data=payload.model_dump(exclude_unset=True, exclude_none=True),
        context={"project": project},
    )
    serializer.is_valid(raise_exception=True)
    cred = serializer.save(project=project)
    return 201, _serialize_linkedin(cred)


@linkedin_router.get(
    "/{cred_id}/", response=LinkedInCredentialsSchema, auth=drf_authenticate
)
def get_linkedin(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _get_project_or_404(request, project_id)
    cred = _get_linkedin_or_404(project_id, cred_id)
    return _serialize_linkedin(cred)


@linkedin_router.patch(
    "/{cred_id}/", response=LinkedInCredentialsSchema, auth=drf_authenticate
)
def update_linkedin(
    request,
    payload: LinkedInCredentialsUpdateInput,
    project_id: int = Path(...),
    cred_id: int = Path(...),
):
    _require_project_admin(request, project_id)
    cred = _get_linkedin_or_404(project_id, cred_id)
    serializer = LinkedInCredentialsSerializer(
        cred,
        data=payload.model_dump(exclude_unset=True, exclude_none=True),
        partial=True,
        context={"project": cred.project},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return _serialize_linkedin(cred)


@linkedin_router.delete("/{cred_id}/", response={204: None}, auth=drf_authenticate)
def delete_linkedin(request, project_id: int = Path(...), cred_id: int = Path(...)):
    _require_project_admin(request, project_id)
    cred = _get_linkedin_or_404(project_id, cred_id)
    cred.delete()
    return 204, None
