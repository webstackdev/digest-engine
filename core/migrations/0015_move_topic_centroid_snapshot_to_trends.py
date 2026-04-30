from django.db import migrations

TRENDS_MODEL_NAMES = ["topiccentroidsnapshot"]


def rename_trends_content_types(apps, schema_editor):
    """Retarget existing content types to the new trends app label."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    database_alias = schema_editor.connection.alias
    ContentType.objects.using(database_alias).filter(
        app_label="core", model__in=TRENDS_MODEL_NAMES
    ).update(app_label="trends")


def rename_trends_content_types_reverse(apps, schema_editor):
    """Restore the historical core app label on rollback."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    database_alias = schema_editor.connection.alias
    ContentType.objects.using(database_alias).filter(
        app_label="trends", model__in=TRENDS_MODEL_NAMES
    ).update(app_label="core")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0014_move_pipeline_models_to_pipeline"),
        ("trends", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name="TopicCentroidSnapshot"),
            ],
            database_operations=[],
        ),
        migrations.RunPython(
            rename_trends_content_types,
            rename_trends_content_types_reverse,
        ),
    ]
