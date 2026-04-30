"""URL routes for current-user profile endpoints."""

from django.urls import path

from users.api import (
    MembershipInvitationTokenView,
    ProfileAvatarView,
    ProfileView,
)

urlpatterns = [
    path("profile/", ProfileView.as_view(), name="profile"),
    path("profile/avatar/", ProfileAvatarView.as_view(), name="profile-avatar"),
    path(
        "invitations/<str:token>/",
        MembershipInvitationTokenView.as_view(),
        name="membership-invitation-token",
    ),
]
