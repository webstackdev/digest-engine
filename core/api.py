"""REST API viewsets and OpenAPI documentation helpers for the core app.

This module exposes the project-scoped CRUD surface used by the frontend and by
external clients. It also centralizes the drf-spectacular helpers that keep the
generated schema consistent across similar viewsets.
"""

import logging
from typing import Any, cast

from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from content.models import Content, UserFeedback
from core.permissions import (
    IsProjectAdmin,
    IsProjectContributor,
    IsProjectFeedbackEditor,
    IsProjectMember,
    IsProjectMemberWritable,
    get_visible_projects_queryset,
)
from core.serializers import (
    ContentSerializer,
    IngestionRunSerializer,
    IntakeAllowlistSerializer,
    NewsletterIntakeSerializer,
    SkillResultSerializer,
    UserFeedbackSerializer,
)
from ingestion.models import IngestionRun
from newsletters.models import IntakeAllowlist, NewsletterIntake
from projects.models import Project

CLASSIFICATION_SKILL_NAME = "content_classification"
RELEVANCE_SKILL_NAME = "relevance_scoring"
SUMMARIZATION_SKILL_NAME = "summarization"
RELATED_CONTENT_SKILL_NAME = "find_related"

logger = logging.getLogger(__name__)

PROJECT_ID_PARAMETER = OpenApiParameter(
    name="project_id",
    type=int,
    location=OpenApiParameter.PATH,
    description="The unique ID of the project that owns this nested resource.",
)

SKILL_NAME_PARAMETER = OpenApiParameter(
    name="skill_name",
    type=str,
    location=OpenApiParameter.PATH,
    description=(
        "The skill to run for this content item. Supported values: "
        "content_classification, relevance_scoring, summarization, find_related."
    ),
)

PROJECT_CREATE_REQUEST_EXAMPLE = OpenApiExample(
    "Create Project Request",
    value={
        "name": "AI Weekly",
        "topic_description": "Coverage of developer tools, model releases, and applied AI workflows.",
        "content_retention_days": 180,
    },
    request_only=True,
)

PROJECT_RESPONSE_EXAMPLE = OpenApiExample(
    "Project Response",
    value={
        "id": 1,
        "name": "AI Weekly",
        "topic_description": "Coverage of developer tools, model releases, and applied AI workflows.",
        "content_retention_days": 180,
        "intake_token": "project-token-123",
        "intake_enabled": True,
        "user_role": "admin",
        "has_bluesky_credentials": True,
        "bluesky_handle": "aiweekly.bsky.social",
        "bluesky_is_active": True,
        "bluesky_last_verified_at": "2026-04-26T13:00:00Z",
        "bluesky_last_error": "",
        "created_at": "2026-04-26T12:00:00Z",
    },
    response_only=True,
)

BLUESKY_CREDENTIALS_RESPONSE_EXAMPLE = OpenApiExample(
    "Bluesky Credentials Response",
    value={
        "id": 1,
        "project": 1,
        "handle": "aiweekly.bsky.social",
        "pds_url": "",
        "is_active": True,
        "has_stored_credential": True,
        "last_verified_at": "2026-04-26T13:00:00Z",
        "last_error": "",
        "created_at": "2026-04-26T12:30:00Z",
        "updated_at": "2026-04-26T13:00:00Z",
    },
    response_only=True,
)

MASTODON_CREDENTIALS_RESPONSE_EXAMPLE = OpenApiExample(
    "Mastodon Credentials Response",
    value={
        "id": 1,
        "project": 1,
        "instance_url": "https://hachyderm.io",
        "account_acct": "alice@hachyderm.io",
        "is_active": True,
        "has_stored_credential": True,
        "last_verified_at": "2026-04-26T13:00:00Z",
        "last_error": "",
        "created_at": "2026-04-26T12:30:00Z",
        "updated_at": "2026-04-26T13:00:00Z",
    },
    response_only=True,
)

SOURCE_CONFIG_CREATE_REQUEST_EXAMPLE = OpenApiExample(
    "Create RSS Source Request",
    value={
        "plugin_name": "rss",
        "config": {
            "feed_url": "https://example.com/feed.xml",
        },
        "is_active": True,
    },
    request_only=True,
)

SOURCE_CONFIG_REDDIT_REQUEST_EXAMPLE = OpenApiExample(
    "Create Reddit Source Request",
    value={
        "plugin_name": "reddit",
        "config": {
            "subreddit": "MachineLearning",
            "listing": "both",
            "limit": 25,
        },
        "is_active": True,
    },
    request_only=True,
)

SOURCE_CONFIG_BLUESKY_REQUEST_EXAMPLE = OpenApiExample(
    "Create Bluesky Source Request",
    value={
        "plugin_name": "bluesky",
        "config": {
            "author_handle": "alice.bsky.social",
            "include_replies": False,
            "max_posts_per_fetch": 100,
        },
        "is_active": True,
    },
    request_only=True,
)

SOURCE_CONFIG_MASTODON_REQUEST_EXAMPLE = OpenApiExample(
    "Create Mastodon Source Request",
    value={
        "plugin_name": "mastodon",
        "config": {
            "instance_url": "https://hachyderm.io",
            "hashtag": "platformengineering",
            "include_replies": False,
            "include_reblogs": True,
            "max_statuses_per_fetch": 100,
        },
        "is_active": True,
    },
    request_only=True,
)

SOURCE_CONFIG_RESPONSE_EXAMPLE = OpenApiExample(
    "Source Configuration Response",
    value={
        "id": 12,
        "project": 1,
        "plugin_name": "rss",
        "config": {
            "feed_url": "https://example.com/feed.xml",
        },
        "is_active": True,
        "last_fetched_at": "2026-04-26T12:30:00Z",
    },
    response_only=True,
)

CONTENT_CREATE_REQUEST_EXAMPLE = OpenApiExample(
    "Create Content Request",
    value={
        "url": "https://example.com/posts/agent-memory-patterns",
        "title": "Practical Agent Memory Patterns",
        "author": "Jane Doe",
        "entity": 4,
        "source_plugin": "rss",
        "content_type": "article",
        "published_date": "2026-04-25T14:00:00Z",
        "content_text": "A walkthrough of short-term and long-term memory patterns for production agents.",
        "relevance_score": 0.92,
        "is_reference": False,
        "is_active": True,
    },
    request_only=True,
)

CONTENT_RESPONSE_EXAMPLE = OpenApiExample(
    "Content Response",
    value={
        "id": 44,
        "project": 1,
        "url": "https://example.com/posts/agent-memory-patterns",
        "title": "Practical Agent Memory Patterns",
        "author": "Jane Doe",
        "entity": 4,
        "source_plugin": "rss",
        "content_type": "article",
        "canonical_url": "https://example.com/posts/agent-memory-patterns",
        "published_date": "2026-04-25T14:00:00Z",
        "ingested_at": "2026-04-26T12:05:00Z",
        "content_text": "A walkthrough of short-term and long-term memory patterns for production agents.",
        "relevance_score": 0.92,
        "authority_adjusted_score": 0.95,
        "embedding_id": "emb_01jabcxyz",
        "duplicate_of": None,
        "duplicate_signal_count": 2,
        "is_reference": False,
        "is_active": True,
    },
    response_only=True,
)

SKILL_RESULT_RESPONSE_EXAMPLE = OpenApiExample(
    "Skill Result Response",
    value={
        "id": 91,
        "content": 44,
        "project": 1,
        "skill_name": "relevance_classifier",
        "status": "completed",
        "result_data": {
            "label": "high_relevance",
            "reasoning": "The article directly covers agent memory design patterns.",
        },
        "error_message": "",
        "model_used": "gpt-4.1-mini",
        "latency_ms": 842,
        "confidence": 0.97,
        "created_at": "2026-04-26T12:06:00Z",
        "superseded_by": None,
    },
    response_only=True,
)

AUTHENTICATION_REQUIRED_EXAMPLE = OpenApiExample(
    "Authentication Required",
    value={
        "type": "client_error",
        "errors": [
            {
                "code": "not_authenticated",
                "detail": "Authentication credentials were not provided.",
                "attr": None,
            }
        ],
    },
    response_only=True,
    status_codes=["403"],
)

AUTHENTICATION_REQUIRED_RESPONSE = OpenApiResponse(
    response=inline_serializer(
        name="AuthenticationRequiredResponse",
        fields={
            "type": serializers.CharField(),
            "errors": inline_serializer(
                name="AuthenticationRequiredError",
                fields={
                    "code": serializers.CharField(),
                    "detail": serializers.CharField(),
                    "attr": serializers.CharField(allow_null=True),
                },
                many=True,
            ),
        },
    ),
    description="Authentication credentials are required to access this endpoint.",
    examples=[AUTHENTICATION_REQUIRED_EXAMPLE],
)

BLUESKY_CREDENTIALS_VERIFY_RESPONSE = inline_serializer(
    name="BlueskyCredentialsVerifyResponse",
    fields={
        "status": serializers.CharField(),
        "handle": serializers.CharField(),
        "last_verified_at": serializers.DateTimeField(allow_null=True),
        "last_error": serializers.CharField(allow_blank=True),
    },
)

MASTODON_CREDENTIALS_VERIFY_RESPONSE = inline_serializer(
    name="MastodonCredentialsVerifyResponse",
    fields={
        "status": serializers.CharField(),
        "account_acct": serializers.CharField(allow_blank=True),
        "instance_url": serializers.URLField(),
        "last_verified_at": serializers.DateTimeField(allow_null=True),
        "last_error": serializers.CharField(allow_blank=True),
    },
)


def build_success_response(
    response, description: str, examples: list[OpenApiExample] | None = None
):
    """Build a reusable OpenAPI success response object.

    Args:
        response: Serializer, inline serializer, or response object for the schema.
        description: Human-readable description shown in the generated docs.
        examples: Optional example payloads to attach to the response.

    Returns:
        A configured ``OpenApiResponse`` instance.
    """

    response_kwargs = {
        "response": response,
        "description": description,
    }
    if examples is not None:
        response_kwargs["examples"] = examples
    return OpenApiResponse(**response_kwargs)


def build_crud_action_overrides(
    serializer_class,
    resource_plural: str,
    resource_singular: str,
    *,
    list_examples: list[OpenApiExample] | None = None,
    retrieve_examples: list[OpenApiExample] | None = None,
    create_examples: list[OpenApiExample] | None = None,
    create_response_examples: list[OpenApiExample] | None = None,
):
    """Generate common schema overrides for CRUD-style viewset actions.

    Args:
        serializer_class: Serializer used by the viewset.
        resource_plural: Human-readable plural name for the resource.
        resource_singular: Human-readable singular name for the resource.
        list_examples: Optional examples for list responses.
        retrieve_examples: Optional examples for retrieve responses.
        create_examples: Optional request examples for create actions.
        create_response_examples: Optional examples for create responses.

    Returns:
        A mapping suitable for ``action_overrides`` on the documentation helpers
        below.
    """

    overrides: dict[str, dict[str, Any]] = {
        "list": {
            "responses": {
                200: build_success_response(
                    serializer_class(many=True),
                    f"A list of {resource_plural}.",
                    examples=list_examples if list_examples is not None else [],
                ),
                403: AUTHENTICATION_REQUIRED_RESPONSE,
            }
        },
        "retrieve": {
            "responses": {
                200: build_success_response(
                    serializer_class,
                    f"The requested {resource_singular}.",
                    examples=retrieve_examples,
                ),
                403: AUTHENTICATION_REQUIRED_RESPONSE,
            }
        },
        "create": {
            "responses": {
                201: build_success_response(
                    serializer_class,
                    f"The newly created {resource_singular}.",
                    examples=create_response_examples,
                ),
                403: AUTHENTICATION_REQUIRED_RESPONSE,
            }
        },
        "update": {
            "responses": {
                200: build_success_response(
                    serializer_class, f"The updated {resource_singular}."
                ),
                403: AUTHENTICATION_REQUIRED_RESPONSE,
            }
        },
        "partial_update": {
            "responses": {
                200: build_success_response(
                    serializer_class, f"The updated {resource_singular}."
                ),
                403: AUTHENTICATION_REQUIRED_RESPONSE,
            }
        },
        "destroy": {
            "responses": {
                204: OpenApiResponse(
                    description=f"The {resource_singular} was deleted."
                ),
                403: AUTHENTICATION_REQUIRED_RESPONSE,
            }
        },
    }
    if create_examples:
        overrides["create"]["examples"] = create_examples
    return overrides


def document_group_access_viewset(
    resource_plural: str,
    resource_singular: str,
    create_description: str,
    tag: str,
    action_overrides: dict[str, dict] | None = None,
):
    """Decorate a viewset with schema metadata for membership-scoped resources.

    Args:
        resource_plural: Human-readable plural label for the resource.
        resource_singular: Human-readable singular label for the resource.
        create_description: Detailed description for the create action.
        tag: OpenAPI tag applied to each action.
        action_overrides: Optional per-action schema overrides.

    Returns:
        A class decorator produced by ``extend_schema_view``.
    """

    action_overrides = action_overrides or {}

    def schema(action: str, **kwargs):
        schema_kwargs = {"tags": [tag], **kwargs}
        action_override = action_overrides.get(action, {})
        override_responses = action_override.get("responses", {})
        if override_responses:
            responses = dict(schema_kwargs.get("responses", {}))
            responses.update(override_responses)
            schema_kwargs["responses"] = responses
        schema_kwargs.update(
            {key: value for key, value in action_override.items() if key != "responses"}
        )
        return extend_schema(**schema_kwargs)

    return extend_schema_view(
        list=schema(
            "list",
            summary=f"List {resource_plural}",
            description=f"Return all {resource_plural} available to the authenticated user through project membership.",
        ),
        retrieve=schema(
            "retrieve",
            summary=f"Get {resource_singular}",
            description=f"Return a single {resource_singular} available to the authenticated user through project membership.",
        ),
        create=schema(
            "create",
            summary=f"Create {resource_singular}",
            description=create_description,
        ),
        update=schema(
            "update",
            summary=f"Replace {resource_singular}",
            description=f"Replace an existing {resource_singular} available to the authenticated user through project membership.",
        ),
        partial_update=schema(
            "partial_update",
            summary=f"Update {resource_singular}",
            description=f"Update one or more fields on an existing {resource_singular} available to the authenticated user through project membership.",
        ),
        destroy=schema(
            "destroy",
            summary=f"Delete {resource_singular}",
            description=f"Delete an existing {resource_singular} available to the authenticated user through project membership.",
        ),
    )


def document_project_owned_viewset(
    resource_plural: str,
    resource_singular: str,
    create_description: str,
    tag: str,
    action_overrides: dict[str, dict] | None = None,
):
    """Decorate a nested project-scoped viewset with consistent schema metadata.

    Args:
        resource_plural: Human-readable plural label for the resource.
        resource_singular: Human-readable singular label for the resource.
        create_description: Detailed description for the create action.
        tag: OpenAPI tag applied to each action.
        action_overrides: Optional per-action schema overrides.

    Returns:
        A class decorator produced by ``extend_schema_view``.
    """

    parameters = [PROJECT_ID_PARAMETER]
    action_overrides = action_overrides or {}

    def schema(action: str, **kwargs):
        schema_kwargs = {"tags": [tag], **kwargs}
        action_override = action_overrides.get(action, {})
        override_responses = action_override.get("responses", {})
        if override_responses:
            responses = dict(schema_kwargs.get("responses", {}))
            responses.update(override_responses)
            schema_kwargs["responses"] = responses
        schema_kwargs.update(
            {key: value for key, value in action_override.items() if key != "responses"}
        )
        return extend_schema(**schema_kwargs)

    return extend_schema_view(
        list=schema(
            "list",
            summary=f"List {resource_plural}",
            description=f"Return all {resource_plural} for the selected project.",
            parameters=parameters,
        ),
        retrieve=schema(
            "retrieve",
            summary=f"Get {resource_singular}",
            description=f"Return a single {resource_singular} for the selected project.",
            parameters=parameters,
        ),
        create=schema(
            "create",
            summary=f"Create {resource_singular}",
            description=create_description,
            parameters=parameters,
        ),
        update=schema(
            "update",
            summary=f"Replace {resource_singular}",
            description=f"Replace an existing {resource_singular} for the selected project.",
            parameters=parameters,
        ),
        partial_update=schema(
            "partial_update",
            summary=f"Update {resource_singular}",
            description=f"Update one or more fields on an existing {resource_singular} for the selected project.",
            parameters=parameters,
        ),
        destroy=schema(
            "destroy",
            summary=f"Delete {resource_singular}",
            description=f"Delete an existing {resource_singular} for the selected project.",
            parameters=parameters,
        ),
    )


class ProjectOwnedQuerysetMixin:
    """Scope nested viewsets to the authenticated user's selected project."""

    queryset: Any = None

    def _kwargs(self) -> dict[str, Any]:
        """Return the DRF route kwargs for typed nested-project lookups."""

        return cast(dict[str, Any], getattr(self, "kwargs"))

    def _request(self) -> Any:
        """Return the DRF request object for typed access checks."""

        return getattr(self, "request")

    def get_project(self):
        """Return the project referenced by ``project_id`` after access checks.

        Raises:
            AssertionError: If the nested route does not supply ``project_id``.
            NotFound: If the project does not exist or the user lacks access.
        """

        project_id = self._kwargs().get("project_id")
        if project_id is None:
            raise AssertionError(
                "project_id must be present in nested project-scoped routes"
            )
        try:
            return get_visible_projects_queryset(self._request().user).get(
                pk=project_id
            )
        except Project.DoesNotExist as exc:
            raise NotFound("Project not found.") from exc

    def get_queryset(self):
        """Filter the configured queryset down to the current project."""

        queryset = self.queryset
        if queryset is None:
            raise AssertionError("queryset must be set on project-scoped viewsets")
        return queryset.filter(project=self.get_project())

    def get_serializer_context(self):
        """Inject the resolved project into serializer context."""

        context = cast(dict[str, Any], cast(Any, super()).get_serializer_context())
        context["project"] = self.get_project()
        return context

    def perform_create(self, serializer):
        """Ensure nested resources are always created under the current project."""

        serializer.save(project=self.get_project())


@document_project_owned_viewset(
    resource_plural="content items",
    resource_singular="content item",
    create_description="Create a new content item for the selected project. Any related entity must belong to the same project.",
    tag="Content Library",
    action_overrides=build_crud_action_overrides(
        ContentSerializer,
        resource_plural="content items for the selected project",
        resource_singular="content item",
        create_examples=[CONTENT_CREATE_REQUEST_EXAMPLE, CONTENT_RESPONSE_EXAMPLE],
        create_response_examples=[CONTENT_RESPONSE_EXAMPLE],
        retrieve_examples=[CONTENT_RESPONSE_EXAMPLE],
    ),
)
class ContentViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Browse project content and trigger ad hoc AI processing for it."""

    serializer_class = ContentSerializer
    queryset = Content.objects.select_related("project", "entity")

    def get_permissions(self):
        """Allow all members to read content, contributors to edit, and admins to delete."""

        if self.action == "destroy":
            permission_classes = [IsProjectAdmin]
        elif self.action in {"create", "update", "partial_update", "run_skill"}:
            permission_classes = [IsProjectMemberWritable]
        else:
            permission_classes = [IsProjectMember]
        return [permission() for permission in permission_classes]

    @extend_schema(
        summary="Run content skill",
        description=(
            "Run one ad hoc skill for the selected content item and persist the outcome as a SkillResult. "
            "Supported skill names are content_classification, relevance_scoring, summarization, and find_related."
        ),
        tags=["AI Processing"],
        parameters=[PROJECT_ID_PARAMETER, SKILL_NAME_PARAMETER],
        request=None,
        responses={
            201: SkillResultSerializer,
            202: SkillResultSerializer,
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
    )
    @action(detail=True, methods=["post"], url_path=r"skills/(?P<skill_name>[^/.]+)")
    def run_skill(self, request, *args, **kwargs):
        """Execute one supported ad hoc skill for a content item.

        Relevant and summarization requests are queued through Celery, while the
        other supported skills execute inline and return their ``SkillResult``
        immediately.
        """

        from core.pipeline import execute_ad_hoc_skill
        from core.tasks import queue_content_skill

        skill_name = str(kwargs["skill_name"])
        if skill_name not in {
            CLASSIFICATION_SKILL_NAME,
            RELEVANCE_SKILL_NAME,
            SUMMARIZATION_SKILL_NAME,
            RELATED_CONTENT_SKILL_NAME,
        }:
            raise serializers.ValidationError(
                {
                    "skill_name": (
                        "Unsupported skill. Choose one of: content_classification, relevance_scoring, "
                        "summarization, find_related."
                    )
                }
            )

        content = self.get_object()
        if skill_name in {RELEVANCE_SKILL_NAME, SUMMARIZATION_SKILL_NAME}:
            skill_result = queue_content_skill(content, skill_name)
            serializer = SkillResultSerializer(
                skill_result, context=self.get_serializer_context()
            )
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

        skill_result = execute_ad_hoc_skill(content, skill_name)
        serializer = SkillResultSerializer(
            skill_result, context=self.get_serializer_context()
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@document_project_owned_viewset(
    resource_plural="user feedback entries",
    resource_singular="user feedback entry",
    create_description="Create a new feedback entry for content in the selected project. The authenticated user is recorded automatically.",
    tag="Feedback",
    action_overrides=build_crud_action_overrides(
        UserFeedbackSerializer,
        resource_plural="user feedback entries for the selected project",
        resource_singular="user feedback entry",
    ),
)
class UserFeedbackViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Capture editor feedback on project content items."""

    serializer_class = UserFeedbackSerializer
    queryset = UserFeedback.objects.select_related("content", "project", "user")

    def get_permissions(self):
        """Allow all members to read feedback and owners or admins to modify it."""

        return [IsProjectFeedbackEditor()]

    def perform_create(self, serializer):
        """Attach the authenticated user automatically to new feedback rows."""

        serializer.save(project=self.get_project(), user=self.request.user)


@document_project_owned_viewset(
    resource_plural="ingestion runs",
    resource_singular="ingestion run",
    create_description="Create a new ingestion run record for the selected project to track a content ingestion attempt and its status.",
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        IngestionRunSerializer,
        resource_plural="ingestion runs for the selected project",
        resource_singular="ingestion run",
    ),
)
class IngestionRunViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Inspect ingestion-run history for a project."""

    serializer_class = IngestionRunSerializer
    queryset = IngestionRun.objects.select_related("project")

    def get_permissions(self):
        """Allow all members to read ingestion runs and contributors to manage them."""

        if self.action in {"create", "update", "partial_update", "destroy"}:
            permission_classes = [IsProjectMemberWritable]
        else:
            permission_classes = [IsProjectMember]
        return [permission() for permission in permission_classes]


@document_project_owned_viewset(
    resource_plural="intake allowlist entries",
    resource_singular="intake allowlist entry",
    create_description=(
        "Create a new confirmed or pending sender allowlist entry for the selected "
        "project's newsletter intake workflow."
    ),
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        IntakeAllowlistSerializer,
        resource_plural="intake allowlist entries for the selected project",
        resource_singular="intake allowlist entry",
    ),
)
class IntakeAllowlistViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Manage newsletter sender allowlist entries for a project."""

    serializer_class = IntakeAllowlistSerializer
    queryset = IntakeAllowlist.objects.select_related("project")

    def get_permissions(self):
        """Restrict intake allowlist access to project contributors."""

        return [IsProjectContributor()]


@document_project_owned_viewset(
    resource_plural="newsletter intake entries",
    resource_singular="newsletter intake entry",
    create_description=(
        "Newsletter intake entries are created by inbound email processing and are "
        "exposed read-only for audit and troubleshooting."
    ),
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        NewsletterIntakeSerializer,
        resource_plural="newsletter intake entries for the selected project",
        resource_singular="newsletter intake entry",
    ),
)
class NewsletterIntakeViewSet(ProjectOwnedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Inspect inbound newsletter history for a project."""

    serializer_class = NewsletterIntakeSerializer
    queryset = NewsletterIntake.objects.select_related("project")

    def get_permissions(self):
        """Allow any project member to inspect newsletter intake history."""

        return [IsProjectMember()]
