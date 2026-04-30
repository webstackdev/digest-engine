import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0001_initial"),
        ("entities", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="entitycandidate",
                    name="first_seen_in",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="entity_candidates",
                        to="content.content",
                    ),
                ),
                migrations.AlterField(
                    model_name="entitymention",
                    name="content",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="entity_mentions",
                        to="content.content",
                    ),
                ),
            ],
            database_operations=[],
        )
    ]