import django.db.models.deletion
from django.db import migrations, models


CONTENT_MODEL_NAMES = ["content", "userfeedback"]
INGESTION_MODEL_NAMES = ["ingestionrun"]


def rename_content_and_ingestion_content_types(apps, schema_editor):
    """Retarget existing content types to the new owning app labels."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    database_alias = schema_editor.connection.alias
    ContentType.objects.using(database_alias).filter(
        app_label="core", model__in=CONTENT_MODEL_NAMES
    ).update(app_label="content")
    ContentType.objects.using(database_alias).filter(
        app_label="core", model__in=INGESTION_MODEL_NAMES
    ).update(app_label="ingestion")


def rename_content_and_ingestion_content_types_reverse(apps, schema_editor):
    """Restore the historical core app label on rollback."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    database_alias = schema_editor.connection.alias
    ContentType.objects.using(database_alias).filter(
        app_label="content", model__in=CONTENT_MODEL_NAMES
    ).update(app_label="core")
    ContentType.objects.using(database_alias).filter(
        app_label="ingestion", model__in=INGESTION_MODEL_NAMES
    ).update(app_label="core")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0011_move_entity_models_to_entities"),
        ("content", "0001_initial"),
        ("ingestion", "0001_initial"),
        ("entities", "0002_alter_entitycandidate_first_seen_in_and_more"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="skillresult",
                    name="content",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="skill_results",
                        to="content.content",
                    ),
                ),
                migrations.AlterField(
                    model_name="reviewqueue",
                    name="content",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="review_queue_items",
                        to="content.content",
                    ),
                ),
                migrations.DeleteModel(name="IngestionRun"),
                migrations.DeleteModel(name="Content"),
                migrations.DeleteModel(name="UserFeedback"),
            ],
            database_operations=[],
        ),
        migrations.RunPython(
            rename_content_and_ingestion_content_types,
            rename_content_and_ingestion_content_types_reverse,
        ),
    ]
