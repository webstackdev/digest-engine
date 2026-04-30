"""Avatar-processing tasks for the users app."""

from __future__ import annotations

from io import BytesIO

from celery import shared_task
from django.core.files.base import ContentFile
from PIL import Image, ImageOps

from users.models import AppUser, avatar_thumbnail_path


def build_avatar_thumbnail(user: AppUser) -> str | None:
    """Generate and store a WebP thumbnail for one user's avatar.

    Args:
        user: User whose avatar should be thumbnailed.

    Returns:
        The stored thumbnail path, or ``None`` when no avatar exists.
    """

    if not user.avatar:
        return None

    storage = user.avatar.storage
    thumbnail_name = avatar_thumbnail_path(user)

    if storage.exists(thumbnail_name):
        storage.delete(thumbnail_name)

    user.avatar.open("rb")
    try:
        with Image.open(user.avatar) as source_image:
            image = ImageOps.exif_transpose(source_image)
            if image.mode not in {"RGB", "RGBA"}:
                image = image.convert("RGBA")

            image.thumbnail((256, 256), Image.Resampling.LANCZOS)
            if image.mode == "RGBA":
                image = image.convert("RGB")

            buffer = BytesIO()
            image.save(buffer, format="WEBP", quality=85)
    finally:
        user.avatar.close()

    storage.save(thumbnail_name, ContentFile(buffer.getvalue()))
    return thumbnail_name


@shared_task(name="users.tasks.generate_avatar_thumbnail")
def generate_avatar_thumbnail(user_id: int) -> str | None:
    """Generate a stored thumbnail for the given user's avatar.

    Args:
        user_id: Primary key of the user whose avatar should be thumbnailed.

    Returns:
        The stored thumbnail path, or ``None`` when no avatar exists.
    """

    user = AppUser.objects.get(pk=user_id)
    return build_avatar_thumbnail(user)
