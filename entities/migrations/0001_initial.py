import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("projects", "0003_remove_project_group"),
        ("core", "0010_move_project_models_to_projects"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="Entity",
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
                        (
                            "type",
                            models.CharField(
                                choices=[
                                    ("individual", "Individual"),
                                    ("vendor", "Vendor"),
                                    ("organization", "Organization"),
                                ],
                                max_length=32,
                            ),
                        ),
                        ("description", models.TextField(blank=True)),
                        ("authority_score", models.FloatField(default=0.5)),
                        ("website_url", models.URLField(blank=True)),
                        ("github_url", models.URLField(blank=True)),
                        ("linkedin_url", models.URLField(blank=True)),
                        (
                            "bluesky_handle",
                            models.CharField(blank=True, max_length=255),
                        ),
                        (
                            "mastodon_handle",
                            models.CharField(blank=True, max_length=255),
                        ),
                        (
                            "twitter_handle",
                            models.CharField(blank=True, max_length=255),
                        ),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="entities",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["name"],
                        "db_table": "core_entity",
                        "constraints": [
                            models.UniqueConstraint(
                                fields=("project", "name"),
                                name="core_entity_unique_project_name",
                            )
                        ],
                    },
                ),
                migrations.CreateModel(
                    name="EntityAuthoritySnapshot",
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
                        ("mention_component", models.FloatField()),
                        ("feedback_component", models.FloatField()),
                        ("duplicate_component", models.FloatField()),
                        ("decayed_prior", models.FloatField()),
                        ("final_score", models.FloatField()),
                        (
                            "entity",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="authority_snapshots",
                                to="entities.entity",
                            ),
                        ),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="entity_authority_snapshots",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["-computed_at"],
                        "db_table": "core_entityauthoritysnapshot",
                        "indexes": [
                            models.Index(
                                fields=["entity", "-computed_at"],
                                name="core_entity_entity__9fe820_idx",
                            ),
                            models.Index(
                                fields=["project", "-computed_at"],
                                name="core_entity_project_a31e41_idx",
                            ),
                        ],
                    },
                ),
                migrations.CreateModel(
                    name="EntityMention",
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
                            "role",
                            models.CharField(
                                choices=[
                                    ("author", "Author"),
                                    ("subject", "Subject"),
                                    ("quoted", "Quoted"),
                                    ("mentioned", "Mentioned"),
                                ],
                                max_length=16,
                            ),
                        ),
                        (
                            "sentiment",
                            models.CharField(
                                blank=True,
                                choices=[
                                    ("positive", "Positive"),
                                    ("neutral", "Neutral"),
                                    ("negative", "Negative"),
                                ],
                                default="",
                                max_length=16,
                            ),
                        ),
                        ("span", models.TextField(blank=True)),
                        ("confidence", models.FloatField(default=0.0)),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "content",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="entity_mentions",
                                to="core.content",
                            ),
                        ),
                        (
                            "entity",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="mentions",
                                to="entities.entity",
                            ),
                        ),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="entity_mentions",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["-created_at"],
                        "db_table": "core_entitymention",
                        "indexes": [
                            models.Index(
                                fields=["entity", "created_at"],
                                name="core_entity_entity__8ba01e_idx",
                            ),
                            models.Index(
                                fields=["project", "created_at"],
                                name="core_entity_project_dabde7_idx",
                            ),
                        ],
                        "constraints": [
                            models.UniqueConstraint(
                                fields=("content", "entity", "role"),
                                name="core_entitymention_unique_content_entity_role",
                            )
                        ],
                    },
                ),
                migrations.CreateModel(
                    name="EntityCandidate",
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
                        (
                            "suggested_type",
                            models.CharField(
                                choices=[
                                    ("individual", "Individual"),
                                    ("vendor", "Vendor"),
                                    ("organization", "Organization"),
                                ],
                                max_length=32,
                            ),
                        ),
                        ("occurrence_count", models.IntegerField(default=1)),
                        (
                            "status",
                            models.CharField(
                                choices=[
                                    ("pending", "Pending"),
                                    ("accepted", "Accepted"),
                                    ("rejected", "Rejected"),
                                    ("merged", "Merged"),
                                ],
                                default="pending",
                                max_length=16,
                            ),
                        ),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                        (
                            "first_seen_in",
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name="entity_candidates",
                                to="core.content",
                            ),
                        ),
                        (
                            "merged_into",
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name="merged_entity_candidates",
                                to="entities.entity",
                            ),
                        ),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="entity_candidates",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["-occurrence_count", "name"],
                        "db_table": "core_entitycandidate",
                        "indexes": [
                            models.Index(
                                fields=["project", "status", "occurrence_count"],
                                name="core_entity_project_4c32ec_idx",
                            )
                        ],
                        "constraints": [
                            models.UniqueConstraint(
                                fields=("project", "name"),
                                name="core_entitycandidate_unique_project_name",
                            )
                        ],
                    },
                ),
            ],
            database_operations=[],
        )
    ]
