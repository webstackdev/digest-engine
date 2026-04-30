import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("projects", "0003_remove_project_group"),
        ("core", "0011_move_entity_models_to_entities"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="IngestionRun",
                    fields=[
                        (
                            "id",
                            models.BigAutoField(
                                auto_created=True,
                                primary_key=True,
                                serialize=False,
                                verbose_name="ID",
                            ),
                        ),
                        ("plugin_name", models.CharField(max_length=64)),
                        ("started_at", models.DateTimeField(auto_now_add=True)),
                        ("completed_at", models.DateTimeField(blank=True, null=True)),
                        (
                            "status",
                            models.CharField(
                                choices=[
                                    ("running", "Running"),
                                    ("success", "Success"),
                                    ("failed", "Failed"),
                                ],
                                max_length=16,
                            ),
                        ),
                        ("items_fetched", models.IntegerField(default=0)),
                        ("items_ingested", models.IntegerField(default=0)),
                        ("error_message", models.TextField(blank=True)),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="ingestion_runs",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["-started_at"],
                        "db_table": "core_ingestionrun",
                        "indexes": [
                            models.Index(
                                fields=["project", "plugin_name", "-started_at"],
                                name="core_ingest_project_fd3a74_idx",
                            )
                        ],
                    },
                )
            ],
            database_operations=[],
        )
    ]
