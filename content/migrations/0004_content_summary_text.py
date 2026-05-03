from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0003_content_pipeline_state"),
    ]

    operations = [
        migrations.AddField(
            model_name="content",
            name="summary_text",
            field=models.TextField(blank=True, default=""),
        ),
    ]
