from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0005_alter_sourceconfig_plugin_name"),
        ("trends", "0005_original_content_idea"),
    ]

    operations = [
        migrations.CreateModel(
            name="TrendTaskRun",
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
                ("task_name", models.CharField(max_length=64)),
                (
                    "task_run_id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        unique=True,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("started", "Started"),
                            ("completed", "Completed"),
                            ("skipped", "Skipped"),
                            ("failed", "Failed"),
                        ],
                        default="started",
                        max_length=16,
                    ),
                ),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("latency_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True)),
                ("summary", models.JSONField(blank=True, default=dict)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="trend_task_runs",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "db_table": "core_trendtaskrun",
                "ordering": ["-started_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="trendtaskrun",
            index=models.Index(
                fields=["project", "task_name", "-started_at"],
                name="core_trendt_project_113a79_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="trendtaskrun",
            index=models.Index(
                fields=["project", "status", "-started_at"],
                name="core_trendt_project_f23cfe_idx",
            ),
        ),
    ]
