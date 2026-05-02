"""Prometheus-style metrics derived from persisted trend task runs."""

from collections import defaultdict
from hmac import compare_digest

from django.conf import settings
from django.db.models import Count
from django.http import HttpRequest, HttpResponse, HttpResponseForbidden
from django.views.decorators.http import require_GET

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
    return "\n".join(lines) + "\n"


@require_GET
def trend_task_run_metrics_view(request: HttpRequest) -> HttpResponse:
    """Expose trend task run metrics when the request presents ``METRICS_TOKEN``."""

    if not _is_metrics_request_authorized(request):
        return HttpResponseForbidden("Forbidden")
    return HttpResponse(
        _render_trend_task_run_metrics(),
        content_type="text/plain; version=0.0.4; charset=utf-8",
    )
