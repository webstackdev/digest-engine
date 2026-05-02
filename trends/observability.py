"""Helpers for persisting and logging trend pipeline task runs."""

from collections.abc import Callable
from functools import wraps
from time import perf_counter
from typing import Any, TypeVar, cast

import structlog
from django.utils import timezone

from trends.models import TrendTaskRun, TrendTaskRunStatus

TrendTaskSummary = dict[str, Any]
TrendTaskCallable = TypeVar("TrendTaskCallable", bound=Callable[..., TrendTaskSummary])

logger = structlog.get_logger(__name__)

TRACKED_TREND_TASKS = (
    "recompute_topic_centroid",
    "recompute_topic_clusters",
    "recompute_topic_velocity",
    "recompute_source_diversity",
    "generate_theme_suggestions",
    "generate_original_content_ideas",
)


def observe_trend_task_run(
    task_name: str,
    *,
    skipped_if: Callable[[TrendTaskSummary], bool] | None = None,
) -> Callable[[TrendTaskCallable], TrendTaskCallable]:
    """Persist one ``TrendTaskRun`` row for each project-scoped task execution."""

    def decorator(func: TrendTaskCallable) -> TrendTaskCallable:
        @wraps(func)
        def wrapper(project_id: int, *args: object, **kwargs: object) -> TrendTaskSummary:
            task_run = TrendTaskRun.objects.create(
                project_id=project_id,
                task_name=task_name,
            )
            started_at = timezone.now()
            started = perf_counter()
            logger.info(
                "trend_task_run.started",
                project_id=project_id,
                task_name=task_name,
                task_run_id=str(task_run.task_run_id),
            )

            try:
                result = func(project_id, *args, **kwargs)
            except Exception as exc:
                latency_ms = max(0, round((perf_counter() - started) * 1000))
                finished_at = timezone.now()
                TrendTaskRun.objects.filter(pk=task_run.pk).update(
                    status=TrendTaskRunStatus.FAILED,
                    finished_at=finished_at,
                    latency_ms=latency_ms,
                    error_message=str(exc),
                )
                logger.exception(
                    "trend_task_run.failed",
                    project_id=project_id,
                    task_name=task_name,
                    task_run_id=str(task_run.task_run_id),
                    latency_ms=latency_ms,
                    started_at=started_at.isoformat(),
                    finished_at=finished_at.isoformat(),
                )
                raise

            latency_ms = max(0, round((perf_counter() - started) * 1000))
            finished_at = timezone.now()
            status = (
                TrendTaskRunStatus.SKIPPED
                if skipped_if is not None and skipped_if(result)
                else TrendTaskRunStatus.COMPLETED
            )
            TrendTaskRun.objects.filter(pk=task_run.pk).update(
                status=status,
                finished_at=finished_at,
                latency_ms=latency_ms,
                summary=result,
                error_message="",
            )
            logger.info(
                "trend_task_run.completed",
                project_id=project_id,
                task_name=task_name,
                task_run_id=str(task_run.task_run_id),
                status=status,
                latency_ms=latency_ms,
                started_at=started_at.isoformat(),
                finished_at=finished_at.isoformat(),
            )
            return result

        return cast(TrendTaskCallable, wrapper)

    return decorator
