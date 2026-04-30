import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("projects", "0003_remove_project_group"),
        ("entities", "0001_initial"),
        ("core", "0011_move_entity_models_to_entities"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="Content",
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
                        ("url", models.URLField()),
                        ("title", models.CharField(max_length=512)),
                        ("author", models.CharField(blank=True, max_length=255)),
                        (
                            "source_plugin",
                            models.CharField(max_length=64),
                        ),
                        ("content_type", models.CharField(blank=True, max_length=64)),
                        (
                            "canonical_url",
                            models.URLField(blank=True, db_index=True, default=""),
                        ),
                        ("published_date", models.DateTimeField()),
                        ("ingested_at", models.DateTimeField(auto_now_add=True)),
                        ("content_text", models.TextField()),
                        (
                            "relevance_score",
                            models.FloatField(blank=True, null=True),
                        ),
                        (
                            "authority_adjusted_score",
                            models.FloatField(blank=True, null=True),
                        ),
                        ("embedding_id", models.CharField(blank=True, max_length=64)),
                        ("source_metadata", models.JSONField(blank=True, default=dict)),
                        ("duplicate_signal_count", models.IntegerField(default=0)),
                        ("is_reference", models.BooleanField(default=False)),
                        ("is_active", models.BooleanField(default=True)),
                        (
                            "duplicate_of",
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name="duplicates",
                                to="content.content",
                            ),
                        ),
                        (
                            "entity",
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name="contents",
                                to="entities.entity",
                            ),
                        ),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="contents",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["-published_date"],
                        "db_table": "core_content",
                        "indexes": [
                            models.Index(
                                fields=["project", "-published_date"],
                                name="core_conten_project_6662d0_idx",
                            ),
                            models.Index(
                                fields=["project", "-relevance_score"],
                                name="core_conten_project_127912_idx",
                            ),
                            models.Index(
                                fields=["project", "-authority_adjusted_score"],
                                name="core_conten_project_44fd9d_idx",
                            ),
                            models.Index(
                                fields=["project", "is_reference"],
                                name="core_conten_project_c689be_idx",
                            ),
                            models.Index(
                                fields=["url"],
                                name="core_conten_url_4d8416_idx",
                            ),
                        ],
                    },
                ),
                migrations.CreateModel(
                    name="UserFeedback",
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
                            "feedback_type",
                            models.CharField(
                                choices=[("upvote", "Upvote"), ("downvote", "Downvote")],
                                max_length=16,
                            ),
                        ),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "content",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="feedback",
                                to="content.content",
                            ),
                        ),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="feedback",
                                to="projects.project",
                            ),
                        ),
                        (
                            "user",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="content_feedback",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["-created_at"],
                        "db_table": "core_userfeedback",
                        "constraints": [
                            models.UniqueConstraint(
                                fields=("content", "user"),
                                name="core_feedback_unique_content_user",
                            )
                        ],
                    },
                ),
            ],
            database_operations=[],
        )
    ]
