from django.db import migrations

NEWSLETTER_MODEL_NAMES = ["intakeallowlist", "newsletterintake"]


def rename_newsletter_content_types(apps, schema_editor):
    """Retarget existing content types to the new newsletters app label."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    database_alias = schema_editor.connection.alias
    ContentType.objects.using(database_alias).filter(
        app_label="core", model__in=NEWSLETTER_MODEL_NAMES
    ).update(app_label="newsletters")


def rename_newsletter_content_types_reverse(apps, schema_editor):
    """Restore the historical core app label on rollback."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    database_alias = schema_editor.connection.alias
    ContentType.objects.using(database_alias).filter(
        app_label="newsletters", model__in=NEWSLETTER_MODEL_NAMES
    ).update(app_label="core")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0012_move_content_models_to_content_and_ingestion"),
        ("newsletters", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name="NewsletterIntake"),
                migrations.DeleteModel(name="IntakeAllowlist"),
            ],
            database_operations=[],
        ),
        migrations.RunPython(
            rename_newsletter_content_types,
            rename_newsletter_content_types_reverse,
        ),
    ]
