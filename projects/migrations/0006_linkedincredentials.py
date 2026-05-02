from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("projects", "0005_alter_sourceconfig_plugin_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="LinkedInCredentials",
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
                ("member_urn", models.CharField(blank=True, max_length=255)),
                ("access_token_encrypted", models.TextField(blank=True)),
                ("refresh_token_encrypted", models.TextField(blank=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("last_verified_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "project",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="linkedin_credentials",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "LinkedIn credentials",
                "db_table": "projects_linkedincredentials",
                "ordering": ["project__name"],
            },
        ),
    ]