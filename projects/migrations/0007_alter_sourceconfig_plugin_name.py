from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("projects", "0006_linkedincredentials"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sourceconfig",
            name="plugin_name",
            field=models.CharField(
                choices=[
                    ("rss", "RSS"),
                    ("reddit", "Reddit"),
                    ("bluesky", "Bluesky"),
                    ("mastodon", "Mastodon"),
                    ("linkedin", "LinkedIn"),
                ],
                max_length=64,
            ),
        ),
    ]
