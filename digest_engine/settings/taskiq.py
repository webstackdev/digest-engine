"""Taskiq settings shared by the broker bootstrap and future task migrations."""

from __future__ import annotations

import os

from .base import env_bool

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
TASKIQ_RESULT_BACKEND_URL = os.getenv("TASKIQ_RESULT_BACKEND_URL", REDIS_URL)
TASKIQ_ALWAYS_EAGER = env_bool("TASKIQ_ALWAYS_EAGER", default=False)
TASKIQ_SCHEDULER_SKIP_FIRST_RUN = env_bool(
    "TASKIQ_SCHEDULER_SKIP_FIRST_RUN", default=True
)

__all__ = [
    "REDIS_URL",
    "RABBITMQ_URL",
    "TASKIQ_ALWAYS_EAGER",
    "TASKIQ_RESULT_BACKEND_URL",
    "TASKIQ_SCHEDULER_SKIP_FIRST_RUN",
]
