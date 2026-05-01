import django.db.models.deletion

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0001_initial"),
        ("trends", "0004_source_diversity_snapshot"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="OriginalContentIdea",
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
                ("angle_title", models.CharField(max_length=255)),
                ("summary", models.TextField()),
                ("suggested_outline", models.TextField()),
                ("why_now", models.TextField()),
                ("generated_by_model", models.CharField(max_length=128)),
                ("self_critique_score", models.FloatField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("dismissed", "Dismissed"),
                            ("written", "Written"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("dismissal_reason", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                (
                    "decided_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="decided_original_content_ideas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="original_content_ideas",
                        to="projects.project",
                    ),
                ),
                (
                    "related_cluster",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="original_content_ideas",
                        to="trends.topiccluster",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "id"],
                "db_table": "core_originalcontentidea",
                "indexes": [
                    models.Index(
                        fields=["project", "status", "-created_at"],
                        name="core_idea_project_7f21_idx",
                    ),
                ],
            },
        ),
        migrations.AddField(
            model_name="originalcontentidea",
            name="supporting_contents",
            field=models.ManyToManyField(
                blank=True,
                related_name="supporting_ideas",
                to="content.content",
            ),
        ),
    ]
