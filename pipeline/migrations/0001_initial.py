import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("projects", "0003_remove_project_group"),
        ("content", "0001_initial"),
        ("core", "0013_move_newsletter_models_to_newsletters"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="SkillResult",
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
                        ("skill_name", models.CharField(max_length=64)),
                        (
                            "status",
                            models.CharField(
                                choices=[
                                    ("pending", "Pending"),
                                    ("running", "Running"),
                                    ("completed", "Completed"),
                                    ("failed", "Failed"),
                                ],
                                max_length=16,
                            ),
                        ),
                        ("result_data", models.JSONField(blank=True, null=True)),
                        ("error_message", models.TextField(blank=True)),
                        ("model_used", models.CharField(blank=True, max_length=64)),
                        ("latency_ms", models.IntegerField(blank=True, null=True)),
                        ("confidence", models.FloatField(blank=True, null=True)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "content",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="skill_results",
                                to="content.content",
                            ),
                        ),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="skill_results",
                                to="projects.project",
                            ),
                        ),
                        (
                            "superseded_by",
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name="supersedes",
                                to="pipeline.skillresult",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["-created_at"],
                        "db_table": "core_skillresult",
                        "indexes": [
                            models.Index(
                                fields=["content", "skill_name"],
                                name="core_skillr_content_0d49f9_idx",
                            ),
                            models.Index(
                                fields=["project", "created_at"],
                                name="core_skillr_project_60360b_idx",
                            ),
                        ],
                    },
                ),
                migrations.CreateModel(
                    name="ReviewQueue",
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
                        (
                            "reason",
                            models.CharField(
                                choices=[
                                    (
                                        "low_confidence_classification",
                                        "Low Confidence Classification",
                                    ),
                                    ("borderline_relevance", "Borderline Relevance"),
                                ],
                                max_length=64,
                            ),
                        ),
                        ("confidence", models.FloatField()),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        ("resolved", models.BooleanField(default=False)),
                        (
                            "resolution",
                            models.CharField(
                                blank=True,
                                choices=[
                                    ("human_approved", "Human Approved"),
                                    ("human_rejected", "Human Rejected"),
                                ],
                                max_length=64,
                            ),
                        ),
                        (
                            "content",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="review_queue_items",
                                to="content.content",
                            ),
                        ),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="review_queue_items",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["resolved", "-created_at"],
                        "db_table": "core_reviewqueue",
                    },
                ),
            ],
            database_operations=[],
        )
    ]
