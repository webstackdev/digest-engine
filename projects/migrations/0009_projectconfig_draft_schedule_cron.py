from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("projects", "0008_projectconfig_authority_weight_cross_newsletter_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectconfig",
            name="draft_schedule_cron",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]