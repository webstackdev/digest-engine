import django.db.models.deletion
from django.db import migrations, models

import newsletters.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("projects", "0003_remove_project_group"),
        ("core", "0012_move_content_models_to_content_and_ingestion"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="IntakeAllowlist",
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
                        ("sender_email", models.EmailField(max_length=254)),
                        ("confirmed_at", models.DateTimeField(blank=True, null=True)),
                        (
                            "confirmation_token",
                            models.CharField(
                                default=newsletters.models.generate_confirmation_token,
                                max_length=64,
                                unique=True,
                            ),
                        ),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="intake_allowlist",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["sender_email"],
                        "db_table": "core_intakeallowlist",
                        "constraints": [
                            models.UniqueConstraint(
                                fields=("project", "sender_email"),
                                name="core_allowlist_unique_project_sender",
                            )
                        ],
                    },
                ),
                migrations.CreateModel(
                    name="NewsletterIntake",
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
                        ("sender_email", models.EmailField(max_length=254)),
                        ("subject", models.CharField(max_length=512)),
                        ("received_at", models.DateTimeField(auto_now_add=True)),
                        ("raw_html", models.TextField(blank=True)),
                        ("raw_text", models.TextField(blank=True)),
                        ("message_id", models.CharField(max_length=255, unique=True)),
                        (
                            "status",
                            models.CharField(
                                choices=[
                                    ("pending", "Pending"),
                                    ("extracted", "Extracted"),
                                    ("failed", "Failed"),
                                    ("rejected", "Rejected"),
                                ],
                                default="pending",
                                max_length=16,
                            ),
                        ),
                        ("extraction_result", models.JSONField(blank=True, null=True)),
                        ("error_message", models.TextField(blank=True)),
                        (
                            "project",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="newsletter_intakes",
                                to="projects.project",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["-received_at"],
                        "db_table": "core_newsletterintake",
                        "indexes": [
                            models.Index(
                                fields=["project", "sender_email", "status"],
                                name="core_newsle_project_eee7a4_idx",
                            )
                        ],
                    },
                ),
            ],
            database_operations=[],
        )
    ]
