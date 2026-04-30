import django.db.models.deletion
from django.db import migrations, models

import projects.model_support


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("core", "0009_topiccentroidsnapshot"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="Project",
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
                        ("name", models.CharField(max_length=255)),
                        ("topic_description", models.TextField()),
                        ("content_retention_days", models.PositiveIntegerField(default=365)),
                        (
                            "intake_token",
                            models.CharField(
                                default=projects.model_support.generate_project_intake_token,
                                editable=False,
                                max_length=64,
                                unique=True,
                            ),
                        ),
                        ("intake_enabled", models.BooleanField(default=False)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "group",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="projects",
                                to="auth.group",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["name"],
                        "db_table": "core_project",
                    },
                ),
                migrations.CreateModel(
                    name="BlueskyCredentials",
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
                        ("handle", models.CharField(max_length=255)),
                        ("app_password_encrypted", models.TextField(blank=True)),
                        ("pds_url", models.URLField(blank=True)),
                        ("is_active", models.BooleanField(default=True)),
                        ("last_verified_at", models.DateTimeField(blank=True, null=True)),
                        ("last_error", models.TextField(blank=True)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                        (
                            "project",
                            models.OneToOneField(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="bluesky_credentials",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["project__name"],
                        "verbose_name_plural": "Bluesky credentials",
                        "db_table": "core_blueskycredentials",
                    },
                ),
                migrations.CreateModel(
                    name="ProjectConfig",
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
                        ("upvote_authority_weight", models.FloatField(default=0.1)),
                        ("downvote_authority_weight", models.FloatField(default=-0.05)),
                        ("authority_decay_rate", models.FloatField(default=0.95)),
                        (
                            "recompute_topic_centroid_on_feedback_save",
                            models.BooleanField(default=True),
                        ),
                        (
                            "project",
                            models.OneToOneField(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="config",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "verbose_name": "Project config",
                        "verbose_name_plural": "Project configs",
                        "db_table": "core_projectconfig",
                    },
                ),
                migrations.CreateModel(
                    name="SourceConfig",
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
                            "plugin_name",
                            models.CharField(
                                choices=[
                                    ("rss", "RSS"),
                                    ("reddit", "Reddit"),
                                    ("bluesky", "Bluesky"),
                                ],
                                max_length=64,
                            ),
                        ),
                        ("config", models.JSONField(default=dict)),
                        ("is_active", models.BooleanField(default=True)),
                        ("last_fetched_at", models.DateTimeField(blank=True, null=True)),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="source_configs",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["plugin_name", "id"],
                        "db_table": "core_sourceconfig",
                        "indexes": [
                            models.Index(
                                fields=["project", "plugin_name", "is_active"],
                                name="core_source_project_f1abc6_idx",
                            )
                        ],
                    },
                ),
            ],
            database_operations=[],
        )
    ]
