import django.db.models.deletion

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("trends", "0002_topic_cluster_models"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ThemeSuggestion",
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
                ("title", models.CharField(max_length=255)),
                ("pitch", models.TextField()),
                ("why_it_matters", models.TextField()),
                ("suggested_angle", models.TextField(blank=True)),
                ("velocity_at_creation", models.FloatField()),
                ("novelty_score", models.FloatField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("dismissed", "Dismissed"),
                            ("used", "Used"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("dismissal_reason", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                (
                    "cluster",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="theme_suggestions",
                        to="trends.topiccluster",
                    ),
                ),
                (
                    "decided_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="decided_theme_suggestions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="theme_suggestions",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "id"],
                "db_table": "core_themesuggestion",
                "indexes": [
                    models.Index(
                        fields=["project", "status", "-created_at"],
                        name="core_themes_project_c0ab5f_idx",
                    ),
                    models.Index(
                        fields=["project", "-velocity_at_creation"],
                        name="core_themes_project_33bd29_idx",
                    ),
                ],
            },
        ),
    ]
