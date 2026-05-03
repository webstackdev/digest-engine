from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0002_content_newsletter_promotion"),
        ("newsletters", "0001_initial"),
        ("projects", "0008_projectconfig_authority_weight_cross_newsletter_and_more"),
        ("trends", "0006_trend_task_run"),
    ]

    operations = [
        migrations.CreateModel(
            name="NewsletterDraft",
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
                ("intro", models.TextField(blank=True)),
                ("outro", models.TextField(blank=True)),
                ("target_publish_date", models.DateField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("generating", "Generating"),
                            ("ready", "Ready"),
                            ("edited", "Edited"),
                            ("published", "Published"),
                            ("discarded", "Discarded"),
                        ],
                        default="generating",
                        max_length=16,
                    ),
                ),
                ("generated_at", models.DateTimeField(auto_now_add=True)),
                ("last_edited_at", models.DateTimeField(blank=True, null=True)),
                ("generation_metadata", models.JSONField(blank=True, default=dict)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="drafts",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "db_table": "core_newsletterdraft",
                "ordering": ["-generated_at", "id"],
            },
        ),
        migrations.CreateModel(
            name="NewsletterDraftOriginalPiece",
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
                ("suggested_outline", models.TextField()),
                ("order", models.IntegerField()),
                (
                    "draft",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="original_pieces",
                        to="newsletters.newsletterdraft",
                    ),
                ),
                (
                    "idea",
                    models.ForeignKey(
                        on_delete=models.deletion.PROTECT,
                        related_name="newsletter_draft_original_pieces",
                        to="trends.originalcontentidea",
                    ),
                ),
            ],
            options={
                "db_table": "core_newsletterdraftoriginalpiece",
                "ordering": ["order", "id"],
            },
        ),
        migrations.CreateModel(
            name="NewsletterDraftSection",
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
                ("lede", models.TextField(blank=True)),
                ("order", models.IntegerField()),
                (
                    "draft",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="sections",
                        to="newsletters.newsletterdraft",
                    ),
                ),
                (
                    "theme_suggestion",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="draft_sections",
                        to="trends.themesuggestion",
                    ),
                ),
            ],
            options={
                "db_table": "core_newsletterdraftsection",
                "ordering": ["order", "id"],
            },
        ),
        migrations.CreateModel(
            name="NewsletterDraftItem",
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
                ("summary_used", models.TextField()),
                ("why_it_matters", models.TextField()),
                ("order", models.IntegerField()),
                (
                    "content",
                    models.ForeignKey(
                        on_delete=models.deletion.PROTECT,
                        related_name="newsletter_draft_items",
                        to="content.content",
                    ),
                ),
                (
                    "section",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="items",
                        to="newsletters.newsletterdraftsection",
                    ),
                ),
            ],
            options={
                "db_table": "core_newsletterdraftitem",
                "ordering": ["order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="newsletterdraft",
            index=models.Index(
                fields=["project", "-generated_at"],
                name="core_nldraft_projgen_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="newsletterdraftoriginalpiece",
            index=models.Index(
                fields=["draft", "order"],
                name="core_nldorig_draftord_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="newsletterdraftsection",
            index=models.Index(
                fields=["draft", "order"],
                name="core_nldsec_draftord_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="newsletterdraftitem",
            index=models.Index(
                fields=["section", "order"],
                name="core_nlditem_secord_idx",
            ),
        ),
    ]
