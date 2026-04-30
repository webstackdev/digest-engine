"""Admin forms for the custom AppUser model."""

from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from users.models import AppUser


class AppUserCreationForm(UserCreationForm):
    """Create-form for the custom application user model."""

    class Meta(UserCreationForm.Meta):
        model = AppUser
        fields = ("username", "email", "display_name")


class AppUserChangeForm(UserChangeForm):
    """Change-form for the custom application user model."""

    class Meta(UserChangeForm.Meta):
        model = AppUser
        fields = "__all__"
