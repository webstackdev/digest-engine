import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pipeline", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="skillresult",
            name="invocation_id",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False),
        ),
        migrations.AddField(
            model_name="reviewqueue",
            name="failed_node",
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name="reviewqueue",
            name="failure_detail",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="reviewqueue",
            name="resolved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reviewqueue",
            name="skill_invocation_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="reviewqueue",
            name="reason",
            field=models.CharField(
                choices=[
                    ("low_confidence_classification", "Low Confidence Classification"),
                    ("borderline_relevance", "Borderline Relevance"),
                    ("retry_exhausted", "Retry Exhausted"),
                    ("circuit_breaker_open", "Circuit Breaker Open"),
                ],
                max_length=64,
            ),
        ),
        migrations.AlterField(
            model_name="reviewqueue",
            name="resolution",
            field=models.CharField(
                blank=True,
                choices=[
                    ("human_approved", "Human Approved"),
                    ("human_rejected", "Human Rejected"),
                    ("retried", "Retried"),
                    ("manually_resolved", "Manually Resolved"),
                    ("archived", "Archived"),
                ],
                max_length=64,
            ),
        ),
        migrations.CreateModel(
            name="PipelineCircuitBreaker",
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
                ("skill_name", models.CharField(max_length=64, unique=True)),
                ("failure_count", models.PositiveIntegerField(default=0)),
                ("window_started_at", models.DateTimeField(blank=True, null=True)),
                ("opened_at", models.DateTimeField(blank=True, null=True)),
                ("last_failure_at", models.DateTimeField(blank=True, null=True)),
                ("last_success_at", models.DateTimeField(blank=True, null=True)),
                ("last_error_message", models.TextField(blank=True)),
            ],
            options={
                "db_table": "core_pipelinecircuitbreaker",
                "ordering": ["skill_name"],
            },
        ),
    ]
