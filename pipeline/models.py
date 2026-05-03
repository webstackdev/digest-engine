"""Pipeline-domain models for persisted AI workflow state."""

import uuid

from django.db import models

from content.models import Content
from projects.models import Project


class SkillStatus(models.TextChoices):
    """Execution states recorded for AI skill runs."""

    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class ReviewReason(models.TextChoices):
    """Reasons content is pushed to the manual review queue."""

    LOW_CONFIDENCE_CLASSIFICATION = (
        "low_confidence_classification",
        "Low Confidence Classification",
    )
    BORDERLINE_RELEVANCE = "borderline_relevance", "Borderline Relevance"
    RETRY_EXHAUSTED = "retry_exhausted", "Retry Exhausted"
    CIRCUIT_BREAKER_OPEN = "circuit_breaker_open", "Circuit Breaker Open"


class ReviewResolution(models.TextChoices):
    """Human outcomes for review queue items."""

    HUMAN_APPROVED = "human_approved", "Human Approved"
    HUMAN_REJECTED = "human_rejected", "Human Rejected"
    RETRIED = "retried", "Retried"
    MANUALLY_RESOLVED = "manually_resolved", "Manually Resolved"
    ARCHIVED = "archived", "Archived"


class SkillResult(models.Model):
    """Persist the output of one AI skill execution for a content item."""

    content = models.ForeignKey(
        Content, on_delete=models.CASCADE, related_name="skill_results"
    )
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="skill_results"
    )
    skill_name = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=SkillStatus.choices)
    result_data = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    model_used = models.CharField(max_length=64, blank=True)
    latency_ms = models.IntegerField(null=True, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    invocation_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    superseded_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="supersedes",
    )

    class Meta:
        ordering = ["-created_at"]
        db_table = "core_skillresult"
        indexes = [
            models.Index(
                fields=["content", "skill_name"],
                name="core_skillr_content_0d49f9_idx",
            ),
            models.Index(
                fields=["project", "created_at"],
                name="core_skillr_project_60360b_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.skill_name} for {self.content.title}"


class ReviewQueue(models.Model):
    """Track content items that require a human decision."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="review_queue_items"
    )
    content = models.ForeignKey(
        Content, on_delete=models.CASCADE, related_name="review_queue_items"
    )
    reason = models.CharField(max_length=64, choices=ReviewReason.choices)
    confidence = models.FloatField()
    failed_node = models.CharField(max_length=64, blank=True, db_index=True)
    failure_detail = models.TextField(blank=True)
    skill_invocation_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution = models.CharField(
        max_length=64, choices=ReviewResolution.choices, blank=True
    )

    class Meta:
        ordering = ["resolved", "-created_at"]
        db_table = "core_reviewqueue"

    def __str__(self) -> str:
        return f"{self.reason} for {self.content.title}"


class PipelineCircuitBreaker(models.Model):
    """Persist per-skill circuit-breaker state for OpenRouter-backed steps."""

    skill_name = models.CharField(max_length=64, unique=True)
    failure_count = models.PositiveIntegerField(default=0)
    window_started_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    last_failure_at = models.DateTimeField(null=True, blank=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    last_error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["skill_name"]
        db_table = "core_pipelinecircuitbreaker"

    def __str__(self) -> str:
        return f"{self.skill_name} ({'open' if self.opened_at else 'closed'})"
