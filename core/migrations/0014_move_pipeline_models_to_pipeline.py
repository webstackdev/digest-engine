from django.db import migrations

PIPELINE_MODEL_NAMES = ["skillresult", "reviewqueue"]


def rename_pipeline_content_types(apps, schema_editor):
    """Retarget existing content types to the new pipeline app label."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    database_alias = schema_editor.connection.alias
    ContentType.objects.using(database_alias).filter(
        app_label="core", model__in=PIPELINE_MODEL_NAMES
    ).update(app_label="pipeline")


def rename_pipeline_content_types_reverse(apps, schema_editor):
    """Restore the historical core app label on rollback."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    database_alias = schema_editor.connection.alias
    ContentType.objects.using(database_alias).filter(
        app_label="pipeline", model__in=PIPELINE_MODEL_NAMES
    ).update(app_label="core")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0013_move_newsletter_models_to_newsletters"),
        ("pipeline", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name="SkillResult"),
                migrations.DeleteModel(name="ReviewQueue"),
            ],
            database_operations=[],
        ),
        migrations.RunPython(
            rename_pipeline_content_types,
            rename_pipeline_content_types_reverse,
        ),
    ]
