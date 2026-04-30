import django.db.models.deletion
import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0001_initial"),
        ("entities", "0002_alter_entitycandidate_first_seen_in_and_more"),
        ("projects", "0005_alter_sourceconfig_plugin_name"),
        ("trends", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TopicCluster",
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
                (
                    "centroid_vector_id",
                    models.UUIDField(default=uuid.uuid4, unique=True),
                ),
                ("label", models.CharField(blank=True, max_length=255)),
                ("first_seen_at", models.DateTimeField()),
                ("last_seen_at", models.DateTimeField()),
                ("is_active", models.BooleanField(default=True)),
                ("member_count", models.PositiveIntegerField(default=0)),
                (
                    "dominant_entity",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="dominant_topic_clusters",
                        to="entities.entity",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="topic_clusters",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "ordering": ["-last_seen_at", "id"],
                "db_table": "core_topiccluster",
                "indexes": [
                    models.Index(
                        fields=["project", "-last_seen_at"],
                            name="core_topicc_project_ff9533_idx",
                    ),
                    models.Index(
                        fields=["project", "is_active", "-last_seen_at"],
                            name="core_topicc_project_f8f19c_idx",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="TopicVelocitySnapshot",
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
                ("window_count", models.PositiveIntegerField()),
                ("trailing_mean", models.FloatField()),
                ("trailing_stddev", models.FloatField()),
                ("z_score", models.FloatField()),
                ("velocity_score", models.FloatField()),
                (
                    "cluster",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="velocity_snapshots",
                        to="trends.topiccluster",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="topic_velocity_snapshots",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "ordering": ["-computed_at", "id"],
                "db_table": "core_topicvelocitysnapshot",
                "indexes": [
                    models.Index(
                        fields=["project", "-computed_at"],
                            name="core_topicv_project_d00a67_idx",
                    ),
                    models.Index(
                        fields=["cluster", "-computed_at"],
                            name="core_topicv_cluster_257d0d_idx",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ContentClusterMembership",
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
                ("similarity", models.FloatField()),
                ("assigned_at", models.DateTimeField(auto_now_add=True)),
                (
                    "cluster",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="trends.topiccluster",
                    ),
                ),
                (
                    "content",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cluster_memberships",
                        to="content.content",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="content_cluster_memberships",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "ordering": ["-assigned_at", "id"],
                "db_table": "core_contentclustermembership",
                "indexes": [
                    models.Index(
                        fields=["cluster", "-assigned_at"],
                            name="core_conten_cluster_a1e0e7_idx",
                    ),
                    models.Index(
                        fields=["project", "content"],
                            name="core_conten_project_7bf892_idx",
                    ),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("content", "cluster"),
                        name="core_contentcluster_unique_content_cluster",
                    ),
                ],
            },
        ),
    ]
