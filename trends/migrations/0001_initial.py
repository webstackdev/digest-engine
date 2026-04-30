import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("projects", "0003_remove_project_group"),
        ("core", "0014_move_pipeline_models_to_pipeline"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="TopicCentroidSnapshot",
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
                        ("computed_at", models.DateTimeField(auto_now_add=True)),
                        ("centroid_active", models.BooleanField(default=False)),
                        ("centroid_vector", models.JSONField(blank=True, default=list)),
                        ("feedback_count", models.PositiveIntegerField(default=0)),
                        ("upvote_count", models.PositiveIntegerField(default=0)),
                        ("downvote_count", models.PositiveIntegerField(default=0)),
                        (
                            "drift_from_previous",
                            models.FloatField(blank=True, null=True),
                        ),
                        (
                            "drift_from_week_ago",
                            models.FloatField(blank=True, null=True),
                        ),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="topic_centroid_snapshots",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["-computed_at"],
                        "db_table": "core_topiccentroidsnapshot",
                        "indexes": [
                            models.Index(
                                fields=["project", "-computed_at"],
                                name="core_topicc_project_2e2c18_idx",
                            ),
                            models.Index(
                                fields=["project", "centroid_active", "-computed_at"],
                                name="core_topicc_project_6b2dd8_idx",
                            ),
                        ],
                    },
                ),
            ],
            database_operations=[],
        )
    ]
