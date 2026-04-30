"""Django admin registration for the custom application user model."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from users.forms import AppUserChangeForm, AppUserCreationForm
from users.models import AppUser


@admin.register(AppUser)
class AppUserAdmin(UserAdmin):
    """Admin configuration for the custom application user model."""

    add_form = AppUserCreationForm
    form = AppUserChangeForm
    model = AppUser
    list_display = (
        "username",
        "email",
        "display_name",
        "is_staff",
        "is_active",
    )
    fieldsets = UserAdmin.fieldsets + (
        (
            "Profile",
            {
                "fields": (
                    "display_name",
                    "avatar",
                    "bio",
                    "timezone",
                )
            },
        ),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Profile",
            {
                "fields": (
                    "display_name",
                    "email",
                )
            },
        ),
    )
