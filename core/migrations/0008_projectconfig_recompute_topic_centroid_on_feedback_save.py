from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_entityauthoritysnapshot_content_authority_adjusted_score"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectconfig",
            name="recompute_topic_centroid_on_feedback_save",
            field=models.BooleanField(default=True),
        ),
    ]
