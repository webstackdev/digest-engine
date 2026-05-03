from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0002_content_newsletter_promotion"),
    ]

    operations = [
        migrations.AddField(
            model_name="content",
            name="pipeline_state",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("processing", "Processing"),
                    ("completed", "Completed"),
                    ("awaiting_review", "Awaiting Review"),
                    ("archived", "Archived"),
                    ("duplicate", "Duplicate"),
                ],
                db_index=True,
                default="pending",
                max_length=32,
            ),
        ),
    ]
