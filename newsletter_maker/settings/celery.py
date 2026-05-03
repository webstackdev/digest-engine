import os

from celery.schedules import crontab

from .base import env_bool

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Celery: these settings point workers at Redis and keep recurring
# ingestion and trend-analysis jobs on their beat schedules.
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_WORKER_REDIRECT_STDOUTS_LEVEL = "INFO"
CELERY_TASK_TIME_LIMIT = 300
CELERY_TASK_SOFT_TIME_LIMIT = 270
CELERY_BEAT_SCHEDULE = {
    "run-all-source-ingestions-every-6-hours": {
        "task": "core.tasks.run_all_ingestions",
        "schedule": 60 * 60 * 6,
    },
    "refresh-linkedin-tokens-hourly": {
        "task": "core.tasks.refresh_linkedin_tokens",
        "schedule": 60 * 60,
    },
    "run-all-source-quality-recomputations-nightly": {
        "task": "core.tasks.run_all_source_quality_recomputations",
        "schedule": crontab(hour=1, minute=45),
    },
    "run-all-scheduled-newsletter-drafts-every-minute": {
        "task": "core.tasks.run_all_scheduled_newsletter_drafts",
        "schedule": 60,
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
    "run-all-entity-candidate-clustering-nightly": {
        "task": "entities.tasks.run_all_entity_candidate_clustering",
        "schedule": crontab(hour=4, minute=30),
    },
    "run-all-entity-candidate-auto-promotions-nightly": {
        "task": "entities.tasks.run_all_entity_candidate_auto_promotions",
        "schedule": crontab(hour=4, minute=45),
    },
    "run-all-retention-policies-nightly": {
        "task": "core.tasks.run_all_retention_policies",
        "schedule": crontab(hour=5, minute=15),
    },
}

__all__ = [
    "REDIS_URL",
    "CELERY_BROKER_URL",
    "CELERY_RESULT_BACKEND",
    "CELERY_TASK_ALWAYS_EAGER",
    "CELERY_WORKER_REDIRECT_STDOUTS_LEVEL",
    "CELERY_TASK_TIME_LIMIT",
    "CELERY_TASK_SOFT_TIME_LIMIT",
    "CELERY_BEAT_SCHEDULE",
]
