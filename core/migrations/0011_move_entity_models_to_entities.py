import django.db.models.deletion
from django.db import migrations, models

ENTITY_MODEL_NAMES = [
    "entity",
    "entityauthoritysnapshot",
    "entitymention",
    "entitycandidate",
]


def rename_entity_content_types(apps, schema_editor):
    """Retarget existing content types to the new entities app label."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    ContentType.objects.using(schema_editor.connection.alias).filter(
        app_label="core", model__in=ENTITY_MODEL_NAMES
    ).update(app_label="entities")


def rename_entity_content_types_reverse(apps, schema_editor):
    """Restore the historical core app label on rollback."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    ContentType.objects.using(schema_editor.connection.alias).filter(
        app_label="entities", model__in=ENTITY_MODEL_NAMES
    ).update(app_label="core")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0010_move_project_models_to_projects"),
        ("entities", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="content",
                    name="entity",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="contents",
                        to="entities.entity",
                    ),
                ),
                migrations.DeleteModel(name="EntityAuthoritySnapshot"),
                migrations.DeleteModel(name="EntityMention"),
                migrations.DeleteModel(name="EntityCandidate"),
                migrations.DeleteModel(name="Entity"),
            ],
            database_operations=[],
        ),
        migrations.RunPython(
            rename_entity_content_types,
            rename_entity_content_types_reverse,
        ),
    ]
