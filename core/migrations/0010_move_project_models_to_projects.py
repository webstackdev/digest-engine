import django.db.models.deletion
from django.db import migrations, models


PROJECT_MODEL_NAMES = [
    "project",
    "projectconfig",
    "sourceconfig",
    "blueskycredentials",
]


def rename_project_content_types(apps, schema_editor):
    """Retarget existing content types to the new projects app label."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    ContentType.objects.using(schema_editor.connection.alias).filter(
        app_label="core", model__in=PROJECT_MODEL_NAMES
    ).update(app_label="projects")


def rename_project_content_types_reverse(apps, schema_editor):
    """Restore the historical core app label on rollback."""

    ContentType = apps.get_model("contenttypes", "ContentType")
    ContentType.objects.using(schema_editor.connection.alias).filter(
        app_label="projects", model__in=PROJECT_MODEL_NAMES
    ).update(app_label="core")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0009_topiccentroidsnapshot"),
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="entity",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="entities",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="entityauthoritysnapshot",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="entity_authority_snapshots",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="topiccentroidsnapshot",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="topic_centroid_snapshots",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="content",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="contents",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="entitymention",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="entity_mentions",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="entitycandidate",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="entity_candidates",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="intakeallowlist",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="intake_allowlist",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="newsletterintake",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="newsletter_intakes",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="skillresult",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="skill_results",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="userfeedback",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feedback",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="ingestionrun",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ingestion_runs",
                        to="projects.project",
                    ),
                ),
                migrations.AlterField(
                    model_name="reviewqueue",
                    name="project",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="review_queue_items",
                        to="projects.project",
                    ),
                ),
                migrations.DeleteModel(name="BlueskyCredentials"),
                migrations.DeleteModel(name="ProjectConfig"),
                migrations.DeleteModel(name="Project"),
                migrations.DeleteModel(name="SourceConfig"),
            ],
            database_operations=[],
        ),
        migrations.RunPython(
            rename_project_content_types,
            rename_project_content_types_reverse,
        ),
    ]