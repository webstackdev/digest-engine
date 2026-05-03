"""Prometheus-style operational metrics derived from persisted app state."""

from collections import defaultdict
from hmac import compare_digest

from django.conf import settings
from django.db.models import Avg, Count, Min
from django.http import HttpRequest, HttpResponse, HttpResponseForbidden
from django.utils import timezone
from django.views.decorators.http import require_GET

from content.models import Content
from entities.models import Entity
from ingestion.models import IngestionRun
from pipeline.models import ReviewQueue, SkillResult, SkillStatus
from trends.models import TrendTaskRun
from trends.observability import TRACKED_TREND_TASKS


def _escape_label_value(value: object) -> str:
    """Escape one Prometheus label value."""

    return str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _authorization_token(request: HttpRequest) -> str:
    """Extract the bearer token from the Authorization header."""

    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        return ""
    return token.strip()


def _is_metrics_request_authorized(request: HttpRequest) -> bool:
    """Return whether the request carries the configured metrics token."""

    configured_token = settings.METRICS_TOKEN.strip()
    if not configured_token:
        return False
    request_token = _authorization_token(request)
    if not request_token:
        return False
    return compare_digest(request_token, configured_token)


def _render_trend_task_run_metrics() -> str:
    """Render the current trend-task-run database state as Prometheus text."""

    lines = [
        "# HELP newsletter_trend_task_run_total Total persisted trend task runs by project, task, and status.",
        "# TYPE newsletter_trend_task_run_total counter",
    ]

    counts = (
        TrendTaskRun.objects.values("project_id", "task_name", "status")
        .annotate(total=Count("id"))
        .order_by("project_id", "task_name", "status")
    )
    for row in counts:
        lines.append(
            "newsletter_trend_task_run_total"
            f'{{project_id="{_escape_label_value(row["project_id"])}",'
            f'task_name="{_escape_label_value(row["task_name"])}",'
            f'status="{_escape_label_value(row["status"])}"}} '
            f'{row["total"]}'
        )

    lines.extend(
        [
            "# HELP newsletter_trend_task_run_latest_status Latest persisted trend task run status by project and task.",
            "# TYPE newsletter_trend_task_run_latest_status gauge",
            "# HELP newsletter_trend_task_run_latest_latency_ms Latest persisted trend task run latency in milliseconds by project and task.",
            "# TYPE newsletter_trend_task_run_latest_latency_ms gauge",
            "# HELP newsletter_trend_task_run_latest_started_timestamp_seconds Unix timestamp for the latest persisted trend task run start time.",
            "# TYPE newsletter_trend_task_run_latest_started_timestamp_seconds gauge",
            "# HELP newsletter_trend_task_run_latest_finished_timestamp_seconds Unix timestamp for the latest persisted trend task run finish time when present.",
            "# TYPE newsletter_trend_task_run_latest_finished_timestamp_seconds gauge",
        ]
    )

    latest_runs: dict[tuple[int, str], TrendTaskRun] = {}
    ordered_runs = TrendTaskRun.objects.order_by(
        "project_id", "task_name", "-started_at"
    )
    for task_run in ordered_runs:
        latest_runs.setdefault((task_run.project_id, task_run.task_name), task_run)

    project_task_counts: dict[int, int] = defaultdict(int)
    for task_run in latest_runs.values():
        project_task_counts[task_run.project_id] += 1
        project_id_label = _escape_label_value(task_run.project_id)
        task_name_label = _escape_label_value(task_run.task_name)
        status_label = _escape_label_value(task_run.status)
        lines.append(
            "newsletter_trend_task_run_latest_status"
            f'{{project_id="{project_id_label}",task_name="{task_name_label}",status="{status_label}"}} 1'
        )
        if task_run.latency_ms is not None:
            lines.append(
                "newsletter_trend_task_run_latest_latency_ms"
                f'{{project_id="{project_id_label}",task_name="{task_name_label}"}} {task_run.latency_ms}'
            )
        lines.append(
            "newsletter_trend_task_run_latest_started_timestamp_seconds"
            f'{{project_id="{project_id_label}",task_name="{task_name_label}"}} {task_run.started_at.timestamp():.6f}'
        )
        if task_run.finished_at is not None:
            lines.append(
                "newsletter_trend_task_run_latest_finished_timestamp_seconds"
                f'{{project_id="{project_id_label}",task_name="{task_name_label}"}} {task_run.finished_at.timestamp():.6f}'
            )

    lines.extend(
        [
            "# HELP newsletter_trend_task_run_tracked_task_count Number of tracked trend tasks with at least one persisted run for a project.",
            "# TYPE newsletter_trend_task_run_tracked_task_count gauge",
        ]
    )
    for project_id, task_count in sorted(project_task_counts.items()):
        lines.append(
            "newsletter_trend_task_run_tracked_task_count"
            f'{{project_id="{_escape_label_value(project_id)}"}} {task_count}'
        )

    lines.extend(
        [
            "# HELP newsletter_trend_task_run_tracked_task_target Configured number of tracked trend task types expected per project.",
            "# TYPE newsletter_trend_task_run_tracked_task_target gauge",
            f"newsletter_trend_task_run_tracked_task_target {len(TRACKED_TREND_TASKS)}",
        ]
    )

    _append_ingestion_metrics(lines)
    _append_pipeline_metrics(lines)
    _append_authority_metrics(lines)
    return "\n".join(lines) + "\n"


def _append_ingestion_metrics(lines: list[str]) -> None:
    """Append ingestion-run counters and freshness gauges."""

    lines.extend(
        [
            "# HELP newsletter_ingestion_run_total Total persisted ingestion runs by project, plugin, and status.",
            "# TYPE newsletter_ingestion_run_total counter",
        ]
    )

    counts = (
        IngestionRun.objects.values("project_id", "plugin_name", "status")
        .annotate(total=Count("id"))
        .order_by("project_id", "plugin_name", "status")
    )
    for row in counts:
        lines.append(
            "newsletter_ingestion_run_total"
            f'{{project_id="{_escape_label_value(row["project_id"])}",'
            f'plugin_name="{_escape_label_value(row["plugin_name"])}",'
            f'status="{_escape_label_value(row["status"])}"}} '
            f'{row["total"]}'
        )

    lines.extend(
        [
            "# HELP newsletter_ingestion_run_latest_items_fetched Latest fetched item count for a persisted ingestion run.",
            "# TYPE newsletter_ingestion_run_latest_items_fetched gauge",
            "# HELP newsletter_ingestion_run_latest_items_ingested Latest ingested item count for a persisted ingestion run.",
            "# TYPE newsletter_ingestion_run_latest_items_ingested gauge",
            "# HELP newsletter_ingestion_run_latest_completed_age_seconds Age in seconds since the latest completed ingestion run for a project and plugin.",
            "# TYPE newsletter_ingestion_run_latest_completed_age_seconds gauge",
        ]
    )

    latest_runs: dict[tuple[int, str], IngestionRun] = {}
    for ingestion_run in IngestionRun.objects.order_by(
        "project_id", "plugin_name", "-started_at"
    ):
        latest_runs.setdefault(
            (ingestion_run.project_id, ingestion_run.plugin_name), ingestion_run
        )

    now = timezone.now()
    for ingestion_run in latest_runs.values():
        labels = (
            f'{{project_id="{_escape_label_value(ingestion_run.project_id)}",'
            f'plugin_name="{_escape_label_value(ingestion_run.plugin_name)}"}}'
        )
        lines.append(
            f"newsletter_ingestion_run_latest_items_fetched{labels} {ingestion_run.items_fetched}"
        )
        lines.append(
            f"newsletter_ingestion_run_latest_items_ingested{labels} {ingestion_run.items_ingested}"
        )
        if ingestion_run.completed_at is not None:
            age_seconds = max(0.0, (now - ingestion_run.completed_at).total_seconds())
            lines.append(
                f"newsletter_ingestion_run_latest_completed_age_seconds{labels} {age_seconds:.6f}"
            )


def _append_pipeline_metrics(lines: list[str]) -> None:
    """Append pipeline-state, review-queue, and skill execution metrics."""

    lines.extend(
        [
            "# HELP newsletter_pipeline_content_total Current content counts by project and pipeline state.",
            "# TYPE newsletter_pipeline_content_total gauge",
        ]
    )
    content_counts = (
        Content.objects.values("project_id", "pipeline_state")
        .annotate(total=Count("id"))
        .order_by("project_id", "pipeline_state")
    )
    for row in content_counts:
        lines.append(
            "newsletter_pipeline_content_total"
            f'{{project_id="{_escape_label_value(row["project_id"])}",'
            f'pipeline_state="{_escape_label_value(row["pipeline_state"])}"}} '
            f'{row["total"]}'
        )

    lines.extend(
        [
            "# HELP newsletter_pipeline_review_queue_depth Current unresolved review queue depth by project and reason.",
            "# TYPE newsletter_pipeline_review_queue_depth gauge",
            "# HELP newsletter_pipeline_review_queue_oldest_age_seconds Age in seconds of the oldest unresolved review item for a project.",
            "# TYPE newsletter_pipeline_review_queue_oldest_age_seconds gauge",
        ]
    )
    review_counts = (
        ReviewQueue.objects.filter(resolved=False)
        .values("project_id", "reason")
        .annotate(total=Count("id"))
        .order_by("project_id", "reason")
    )
    for row in review_counts:
        lines.append(
            "newsletter_pipeline_review_queue_depth"
            f'{{project_id="{_escape_label_value(row["project_id"])}",'
            f'reason="{_escape_label_value(row["reason"])}"}} '
            f'{row["total"]}'
        )
    now = timezone.now()
    oldest_pending_reviews = (
        ReviewQueue.objects.filter(resolved=False)
        .values("project_id")
        .annotate(oldest_created_at=Min("created_at"))
        .order_by("project_id")
    )
    for row in oldest_pending_reviews:
        oldest_created_at = row["oldest_created_at"]
        if oldest_created_at is None:
            continue
        age_seconds = max(0.0, (now - oldest_created_at).total_seconds())
        lines.append(
            "newsletter_pipeline_review_queue_oldest_age_seconds"
            f'{{project_id="{_escape_label_value(row["project_id"])}"}} {age_seconds:.6f}'
        )

    lines.extend(
        [
            "# HELP newsletter_skill_result_total Total persisted skill executions by project, skill, and status.",
            "# TYPE newsletter_skill_result_total counter",
            "# HELP newsletter_skill_result_average_latency_ms Average persisted skill latency by project and skill.",
            "# TYPE newsletter_skill_result_average_latency_ms gauge",
            "# HELP newsletter_skill_result_failure_ratio Failure ratio for persisted skill executions by project and skill.",
            "# TYPE newsletter_skill_result_failure_ratio gauge",
        ]
    )
    skill_counts = (
        SkillResult.objects.values("project_id", "skill_name", "status")
        .annotate(total=Count("id"))
        .order_by("project_id", "skill_name", "status")
    )
    totals_by_skill: dict[tuple[int, str], int] = defaultdict(int)
    failures_by_skill: dict[tuple[int, str], int] = defaultdict(int)
    for row in skill_counts:
        project_id = int(row["project_id"])
        skill_name = str(row["skill_name"])
        totals_by_skill[(project_id, skill_name)] += int(row["total"])
        if row["status"] == SkillStatus.FAILED:
            failures_by_skill[(project_id, skill_name)] += int(row["total"])
        lines.append(
            "newsletter_skill_result_total"
            f'{{project_id="{_escape_label_value(project_id)}",'
            f'skill_name="{_escape_label_value(skill_name)}",'
            f'status="{_escape_label_value(row["status"])}"}} '
            f'{row["total"]}'
        )
    average_latencies = (
        SkillResult.objects.exclude(latency_ms__isnull=True)
        .values("project_id", "skill_name")
        .annotate(avg_latency_ms=Avg("latency_ms"))
        .order_by("project_id", "skill_name")
    )
    for row in average_latencies:
        lines.append(
            "newsletter_skill_result_average_latency_ms"
            f'{{project_id="{_escape_label_value(row["project_id"])}",'
            f'skill_name="{_escape_label_value(row["skill_name"])}"}} '
            f'{float(row["avg_latency_ms"]):.6f}'
        )
    for (project_id, skill_name), total in sorted(totals_by_skill.items()):
        failure_ratio = failures_by_skill.get((project_id, skill_name), 0) / total
        lines.append(
            "newsletter_skill_result_failure_ratio"
            f'{{project_id="{_escape_label_value(project_id)}",'
            f'skill_name="{_escape_label_value(skill_name)}"}} {failure_ratio:.6f}'
        )


def _append_authority_metrics(lines: list[str]) -> None:
    """Append current entity-authority score distributions by project."""

    lines.extend(
        [
            "# HELP newsletter_entity_authority_score Average current authority score by project.",
            "# TYPE newsletter_entity_authority_score gauge",
            "# HELP newsletter_entity_authority_score_bucket Histogram buckets for current authority scores by project.",
            "# TYPE newsletter_entity_authority_score_bucket histogram",
            "# HELP newsletter_entity_authority_score_count Count of current authority scores by project.",
            "# TYPE newsletter_entity_authority_score_count gauge",
            "# HELP newsletter_entity_authority_score_sum Sum of current authority scores by project.",
            "# TYPE newsletter_entity_authority_score_sum gauge",
        ]
    )
    bucket_bounds = (0.2, 0.4, 0.6, 0.8, 1.0)
    scores_by_project: dict[int, list[float]] = defaultdict(list)
    for row in Entity.objects.values("project_id", "authority_score").order_by(
        "project_id", "id"
    ):
        scores_by_project[int(row["project_id"])].append(float(row["authority_score"]))
    for project_id, scores in sorted(scores_by_project.items()):
        score_sum = sum(scores)
        score_count = len(scores)
        lines.append(
            f'newsletter_entity_authority_score{{project_id="{_escape_label_value(project_id)}"}} {score_sum / score_count:.6f}'
        )
        for bucket_bound in bucket_bounds:
            bucket_total = sum(score <= bucket_bound for score in scores)
            lines.append(
                "newsletter_entity_authority_score_bucket"
                f'{{project_id="{_escape_label_value(project_id)}",le="{bucket_bound:.1f}"}} {bucket_total}'
            )
        lines.append(
            "newsletter_entity_authority_score_bucket"
            f'{{project_id="{_escape_label_value(project_id)}",le="+Inf"}} {score_count}'
        )
        lines.append(
            f'newsletter_entity_authority_score_count{{project_id="{_escape_label_value(project_id)}"}} {score_count}'
        )
        lines.append(
            f'newsletter_entity_authority_score_sum{{project_id="{_escape_label_value(project_id)}"}} {score_sum:.6f}'
        )


@require_GET
def trend_task_run_metrics_view(request: HttpRequest) -> HttpResponse:
    """Expose trend task run metrics when the request presents ``METRICS_TOKEN``."""

    if not _is_metrics_request_authorized(request):
        return HttpResponseForbidden("Forbidden")
    return HttpResponse(
        _render_trend_task_run_metrics(),
        content_type="text/plain; version=0.0.4; charset=utf-8",
    )
