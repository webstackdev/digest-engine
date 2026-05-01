import django.db.models.deletion

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("trends", "0003_theme_suggestion"),
    ]

    operations = [
        migrations.CreateModel(
            name="SourceDiversitySnapshot",
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
                ("window_days", models.PositiveIntegerField(default=14)),
                ("plugin_entropy", models.FloatField()),
                ("source_entropy", models.FloatField()),
                ("author_entropy", models.FloatField()),
                ("cluster_entropy", models.FloatField()),
                ("top_plugin_share", models.FloatField()),
                ("top_source_share", models.FloatField()),
                ("breakdown", models.JSONField(blank=True, default=dict)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="source_diversity_snapshots",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "ordering": ["-computed_at", "id"],
                "db_table": "core_sourcediversitysnapshot",
                "indexes": [
                    models.Index(
                        fields=["project", "-computed_at"],
                        name="core_sourced_project_4bf5_idx",
                    ),
                ],
            },
        ),
    ]
