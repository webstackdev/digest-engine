from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0008_projectconfig_recompute_topic_centroid_on_feedback_save"),
    ]

    operations = [
        migrations.CreateModel(
            name="TopicCentroidSnapshot",
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
                ("computed_at", models.DateTimeField(auto_now_add=True)),
                ("centroid_active", models.BooleanField(default=False)),
                ("centroid_vector", models.JSONField(blank=True, default=list)),
                ("feedback_count", models.PositiveIntegerField(default=0)),
                ("upvote_count", models.PositiveIntegerField(default=0)),
                ("downvote_count", models.PositiveIntegerField(default=0)),
                ("drift_from_previous", models.FloatField(blank=True, null=True)),
                ("drift_from_week_ago", models.FloatField(blank=True, null=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="topic_centroid_snapshots",
                        to="core.project",
                    ),
                ),
            ],
            options={
                "ordering": ["-computed_at"],
            },
        ),
        migrations.AddIndex(
            model_name="topiccentroidsnapshot",
            index=models.Index(
                fields=["project", "-computed_at"],
                name="core_topicc_project_2e2c18_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="topiccentroidsnapshot",
            index=models.Index(
                fields=["project", "centroid_active", "-computed_at"],
                name="core_topicc_project_6b2dd8_idx",
            ),
        ),
    ]
