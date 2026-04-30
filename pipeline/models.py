"""Pipeline-domain models for persisted AI workflow state."""

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


class ReviewResolution(models.TextChoices):
    """Human outcomes for review queue items."""

    HUMAN_APPROVED = "human_approved", "Human Approved"
    HUMAN_REJECTED = "human_rejected", "Human Rejected"


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
    created_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)
    resolution = models.CharField(
        max_length=64, choices=ReviewResolution.choices, blank=True
    )

    class Meta:
        ordering = ["resolved", "-created_at"]
        db_table = "core_reviewqueue"

    def __str__(self) -> str:
        return f"{self.reason} for {self.content.title}"