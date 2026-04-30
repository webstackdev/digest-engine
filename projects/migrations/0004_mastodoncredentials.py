from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("projects", "0003_remove_project_group"),
    ]

    operations = [
        migrations.CreateModel(
            name="MastodonCredentials",
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
                ("instance_url", models.URLField(blank=True)),
                ("account_acct", models.CharField(blank=True, max_length=255)),
                ("access_token_encrypted", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("last_verified_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "project",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="mastodon_credentials",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "Mastodon credentials",
                "ordering": ["project__name"],
                "db_table": "projects_mastodoncredentials",
            },
        ),
    ]
