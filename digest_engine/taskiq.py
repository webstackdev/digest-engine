"""Taskiq broker and scheduler bootstrap for the Digest Engine project."""

from __future__ import annotations

import os
from inspect import iscoroutinefunction
from typing import Any, cast

from asgiref.sync import async_to_sync
from django.conf import settings
from taskiq import TaskiqScheduler
from taskiq.schedule_sources import LabelScheduleSource
from taskiq_aio_pika import AioPikaBroker
from taskiq_redis import RedisAsyncResultBackend

from digest_engine.settings import (
    RABBITMQ_URL,
    TASKIQ_RESULT_BACKEND_URL,
)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "digest_engine.settings")

result_backend = RedisAsyncResultBackend(
    redis_url=TASKIQ_RESULT_BACKEND_URL,
    result_ex_time=60 * 60,
)

broker = AioPikaBroker(RABBITMQ_URL).with_result_backend(result_backend)

scheduler = TaskiqScheduler(
    broker=broker,
    sources=[LabelScheduleSource(broker)],
)


def enqueue_task(task: object, *args: object, **kwargs: object) -> object:
    """Dispatch one Taskiq task from synchronous Django code."""

    return async_to_sync(cast(Any, task).kiq)(*args, **kwargs)


def run_task_inline(task: object, *args: object, **kwargs: object) -> object:
    """Run one Taskiq task inline for eager and test-only flows."""

    original_func = cast(Any, task).original_func
    if iscoroutinefunction(original_func):
        return async_to_sync(original_func)(*args, **kwargs)
    return original_func(*args, **kwargs)


def task_always_eager() -> bool:
    """Return whether Taskiq-backed tasks should execute inline."""

    return bool(getattr(settings, "TASKIQ_ALWAYS_EAGER", False))


__all__ = [
    "broker",
    "enqueue_task",
    "result_backend",
    "run_task_inline",
    "scheduler",
    "task_always_eager",
]
