"""REST API viewsets for project-owned models."""

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api import (
    AUTHENTICATION_REQUIRED_RESPONSE,
    BLUESKY_CREDENTIALS_RESPONSE_EXAMPLE,
    BLUESKY_CREDENTIALS_VERIFY_RESPONSE,
    PROJECT_CREATE_REQUEST_EXAMPLE,
    PROJECT_RESPONSE_EXAMPLE,
    ProjectOwnedQuerysetMixin,
    SOURCE_CONFIG_BLUESKY_REQUEST_EXAMPLE,
    SOURCE_CONFIG_CREATE_REQUEST_EXAMPLE,
    SOURCE_CONFIG_REDDIT_REQUEST_EXAMPLE,
    SOURCE_CONFIG_RESPONSE_EXAMPLE,
    build_crud_action_overrides,
    build_success_response,
    document_group_access_viewset,
    document_project_owned_viewset,
    logger,
)
from core.permissions import (
    IsProjectAdmin,
    IsProjectMember,
    IsProjectMemberWritable,
    get_visible_projects_queryset,
)
from core.plugins.bluesky import BlueskySourcePlugin
from projects.models import (
    BlueskyCredentials,
    Project,
    ProjectConfig,
    ProjectMembership,
    ProjectRole,
    SourceConfig,
    generate_project_intake_token,
)
from projects.serializers import (
    BlueskyCredentialsSerializer,
    ProjectConfigSerializer,
    ProjectMembershipSerializer,
    ProjectSerializer,
    SourceConfigSerializer,
)
from users.models import MembershipInvitation
from users.serializers import MembershipInvitationSerializer


def _assert_project_keeps_admin(
    project: Project,
    membership: ProjectMembership,
    *,
    next_role: str | None = None,
) -> None:
    """Reject changes that would leave a project without an admin."""

    resulting_role = next_role
    if membership.role != ProjectRole.ADMIN or resulting_role == ProjectRole.ADMIN:
        return

    has_other_admin = (
        project.memberships.exclude(pk=membership.pk)
        .filter(role=ProjectRole.ADMIN)
        .exists()
    )
    if not has_other_admin:
        raise serializers.ValidationError(
            {"role": "Projects must keep at least one admin."}
        )


def _send_membership_invitation_email(invitation: MembershipInvitation) -> None:
    """Send the one-time membership invitation email."""

    invite_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/invite/{invitation.token}"
    send_mail(
        subject=f"You're invited to join {invitation.project.name}",
        message=(
            f"You have been invited to join {invitation.project.name} as a "
            f"{invitation.role}.\n\nOpen this link to accept the invitation:\n{invite_url}"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        fail_silently=False,
    )


@document_group_access_viewset(
    resource_plural="projects",
    resource_singular="project",
    create_description="Create a new project for the authenticated user.",
    tag="Project Management",
    action_overrides=build_crud_action_overrides(
        ProjectSerializer,
        resource_plural="projects available to the authenticated user",
        resource_singular="project",
        create_examples=[PROJECT_CREATE_REQUEST_EXAMPLE, PROJECT_RESPONSE_EXAMPLE],
        create_response_examples=[PROJECT_RESPONSE_EXAMPLE],
        retrieve_examples=[PROJECT_RESPONSE_EXAMPLE],
    ),
)
class ProjectViewSet(viewsets.ModelViewSet):
    """Manage projects accessible through the current user's project memberships."""

    serializer_class = ProjectSerializer
    queryset = Project.objects.select_related("group", "bluesky_credentials")
    lookup_url_kwarg = "id"

    def get_permissions(self):
        """Apply role-aware permissions by action for project-level operations."""

        if self.action in {
            "update",
            "partial_update",
            "destroy",
            "rotate_intake_token",
            "verify_bluesky_credentials",
        }:
            permission_classes = [IsProjectAdmin]
        elif self.action in {"list", "retrieve"}:
            permission_classes = [IsProjectMember]
        else:
            permission_classes = self.permission_classes
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """Limit projects to those visible through the authenticated user."""

        return get_visible_projects_queryset(self.request.user).select_related(
            "group", "bluesky_credentials"
        )

    def perform_create(self, serializer):
        """Create the project and make the creator its first admin."""

        project = serializer.save(group=None)
        ProjectMembership.objects.create(
            user=self.request.user,
            project=project,
            role=ProjectRole.ADMIN,
        )

    @extend_schema(
        summary="Rotate newsletter intake token",
        description=(
            "Generate a fresh project-specific newsletter intake token and return the "
            "updated project payload."
        ),
        tags=["Project Management"],
        request=None,
        responses={200: ProjectSerializer, 403: AUTHENTICATION_REQUIRED_RESPONSE},
    )
    @action(detail=True, methods=["post"], url_path="rotate-intake-token")
    def rotate_intake_token(self, request, *args, **kwargs):
        """Generate a fresh intake token for the selected project."""

        project = self.get_object()
        project.intake_token = generate_project_intake_token()
        project.save(update_fields=["intake_token"])
        serializer = self.get_serializer(project)
        return Response(serializer.data)

    @extend_schema(
        summary="Verify Bluesky credentials",
        description=(
            "Verify the selected project's stored Bluesky credentials by authenticating "
            "the account and checking the current session."
        ),
        tags=["Ingestion"],
        request=None,
        responses={
            200: build_success_response(
                BLUESKY_CREDENTIALS_VERIFY_RESPONSE,
                "The project's Bluesky credentials were verified successfully.",
            ),
            400: OpenApiResponse(
                response=inline_serializer(
                    name="BlueskyCredentialsVerifyErrorResponse",
                    fields={
                        "type": serializers.CharField(),
                        "errors": inline_serializer(
                            name="BlueskyCredentialsVerifyError",
                            fields={
                                "code": serializers.CharField(),
                                "detail": serializers.CharField(),
                                "attr": serializers.CharField(allow_null=True),
                            },
                            many=True,
                        ),
                    },
                ),
                description="The project is missing Bluesky credentials or verification failed.",
            ),
            403: AUTHENTICATION_REQUIRED_RESPONSE,
        },
    )
    @action(detail=True, methods=["post"], url_path="verify-bluesky-credentials")
    def verify_bluesky_credentials(self, request, *args, **kwargs):
        """Verify the Bluesky credentials stored for the selected project."""

        project = self.get_object()
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
                "Bluesky credential verification failed for project id=%s",
                project.id,
            )
            raise serializers.ValidationError(
                {
                    "bluesky_credentials": (
                        "Credential verification failed. Please re-check the credentials "
                        "and try again."
                    )
                }
            ) from exc

        credentials.refresh_from_db()
        return Response(
            {
                "status": "verified",
                "handle": credentials.handle,
                "last_verified_at": credentials.last_verified_at,
                "last_error": "",
            }
        )


@document_project_owned_viewset(
    resource_plural="project configurations",
    resource_singular="project configuration",
    create_description="Create a new project configuration record for the selected project, including authority weighting and decay settings.",
    tag="Project Management",
    action_overrides=build_crud_action_overrides(
        ProjectConfigSerializer,
        resource_plural="project configurations for the selected project",
        resource_singular="project configuration",
    ),
)
class ProjectConfigViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Manage per-project scoring and authority configuration."""

    serializer_class = ProjectConfigSerializer
    queryset = ProjectConfig.objects.select_related("project")

    def get_permissions(self):
        """Allow all members to read project config, but only admins to modify it."""

        if self.action in {"update", "partial_update", "create", "destroy"}:
            permission_classes = [IsProjectAdmin]
        else:
            permission_classes = [IsProjectMember]
        return [permission() for permission in permission_classes]


@document_project_owned_viewset(
    resource_plural="Bluesky credentials",
    resource_singular="Bluesky credentials",
    create_description=(
        "Create Bluesky credentials for the selected project. The app password is "
        "accepted write-only and is never returned in API responses."
    ),
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        BlueskyCredentialsSerializer,
        resource_plural="Bluesky credentials for the selected project",
        resource_singular="Bluesky credentials",
        retrieve_examples=[BLUESKY_CREDENTIALS_RESPONSE_EXAMPLE],
    ),
)
class BlueskyCredentialsViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Manage project-scoped Bluesky credentials."""

    serializer_class = BlueskyCredentialsSerializer
    queryset = BlueskyCredentials.objects.select_related("project")

    def get_permissions(self):
        """Restrict Bluesky credential access to project admins."""

        return [IsProjectAdmin()]

    def get_queryset(self):
        """Restrict credentials to the selected project and current user."""

        return super().get_queryset().order_by("-updated_at")


@document_project_owned_viewset(
    resource_plural="source configurations",
    resource_singular="source configuration",
    create_description="Create a new source configuration for the selected project. Plugin-specific configuration is validated before the record is saved.",
    tag="Ingestion",
    action_overrides=build_crud_action_overrides(
        SourceConfigSerializer,
        resource_plural="source configurations for the selected project",
        resource_singular="source configuration",
        create_examples=[
            SOURCE_CONFIG_CREATE_REQUEST_EXAMPLE,
            SOURCE_CONFIG_REDDIT_REQUEST_EXAMPLE,
            SOURCE_CONFIG_BLUESKY_REQUEST_EXAMPLE,
            SOURCE_CONFIG_RESPONSE_EXAMPLE,
        ],
        create_response_examples=[SOURCE_CONFIG_RESPONSE_EXAMPLE],
        retrieve_examples=[SOURCE_CONFIG_RESPONSE_EXAMPLE],
    ),
)
class SourceConfigViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Manage source-plugin configuration for a project."""

    serializer_class = SourceConfigSerializer
    queryset = SourceConfig.objects.select_related("project")

    def get_permissions(self):
        """Allow all members to read source configs, but only contributors to modify them."""

        if self.action == "destroy":
            permission_classes = [IsProjectMemberWritable]
        elif self.action in {"create", "update", "partial_update"}:
            permission_classes = [IsProjectMemberWritable]
        else:
            permission_classes = [IsProjectMember]
        return [permission() for permission in permission_classes]


class ProjectMembershipViewSet(ProjectOwnedQuerysetMixin, viewsets.ModelViewSet):
    """Manage the roster of members attached to one project."""

    serializer_class = ProjectMembershipSerializer
    queryset = ProjectMembership.objects.select_related("project", "user", "invited_by")

    def get_permissions(self):
        """Restrict member-roster management to project admins."""

        return [IsProjectAdmin()]

    def get_queryset(self):
        """Return roster rows for the selected project ordered by join time."""

        return super().get_queryset().order_by("joined_at", "user__username")

    def perform_update(self, serializer):
        """Persist role changes without allowing the last admin to disappear."""

        membership = self.get_object()
        next_role = serializer.validated_data.get("role", membership.role)
        _assert_project_keeps_admin(membership.project, membership, next_role=next_role)
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Remove one membership while preserving at least one project admin."""

        membership = self.get_object()
        _assert_project_keeps_admin(membership.project, membership, next_role=None)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectInvitationViewSet(
    ProjectOwnedQuerysetMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Create, list, and revoke project invitation tokens."""

    serializer_class = MembershipInvitationSerializer
    queryset = MembershipInvitation.objects.select_related("project", "invited_by")

    def get_permissions(self):
        """Restrict invitation management to project admins."""

        return [IsProjectAdmin()]

    def get_queryset(self):
        """Return invitations for the selected project ordered newest first."""

        return super().get_queryset().order_by("-created_at")

    def get_serializer_context(self):
        """Pass the selected project into invitation validation and URL generation."""

        context = super().get_serializer_context()
        context["project"] = self.get_project()
        return context

    def perform_create(self, serializer):
        """Persist the invitation row and dispatch its email."""

        invitation = serializer.save(
            project=self.get_project(),
            invited_by=self.request.user,
        )
        _send_membership_invitation_email(invitation)

    def destroy(self, request, *args, **kwargs):
        """Mark one invitation as revoked instead of deleting it outright."""

        invitation = self.get_object()
        invitation.revoked_at = timezone.now()
        invitation.save(update_fields=["revoked_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
