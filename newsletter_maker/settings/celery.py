import os

from celery.schedules import crontab

from .base import env_bool

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Celery: these settings point workers at Redis and keep recurring
# ingestion and trend-analysis jobs on their beat schedules.
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_TIME_LIMIT = 300
CELERY_TASK_SOFT_TIME_LIMIT = 270
CELERY_BEAT_SCHEDULE = {
    "run-all-source-ingestions-every-6-hours": {
        "task": "core.tasks.run_all_ingestions",
        "schedule": 60 * 60 * 6,
    },
    "run-all-authority-recomputations-nightly": {
        "task": "core.tasks.run_all_authority_recomputations",
        "schedule": crontab(hour=2, minute=0),
    },
    "run-all-topic-centroid-recomputations-nightly": {
        "task": "core.tasks.run_all_topic_centroid_recomputations",
        "schedule": crontab(hour=3, minute=0),
    },
    "run-all-topic-cluster-recomputations-nightly": {
        "task": "core.tasks.run_all_topic_cluster_recomputations",
        "schedule": crontab(hour=4, minute=0),
    },
}

__all__ = [
    "REDIS_URL",
    "CELERY_BROKER_URL",
    "CELERY_RESULT_BACKEND",
    "CELERY_TASK_ALWAYS_EAGER",
    "CELERY_TASK_TIME_LIMIT",
    "CELERY_TASK_SOFT_TIME_LIMIT",
    "CELERY_BEAT_SCHEDULE",
]
