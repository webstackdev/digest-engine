"""Ingestion-domain models split out from the historical core app."""

from django.db import models


class RunStatus(models.TextChoices):
    """Outcome states for ingestion runs."""

    RUNNING = "running", "Running"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"


class IngestionRun(models.Model):
    """Captures the outcome of one source-ingestion execution."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="ingestion_runs"
    )
    plugin_name = models.CharField(max_length=64)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=RunStatus.choices)
    items_fetched = models.IntegerField(default=0)
    items_ingested = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]
        db_table = "core_ingestionrun"
        indexes = [
            models.Index(fields=["project", "plugin_name", "-started_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.plugin_name} for {self.project.name}"
