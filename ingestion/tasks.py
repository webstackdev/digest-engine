"""Celery tasks and helpers for source ingestion."""

import logging

from celery import shared_task
from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from content.deduplication import canonicalize_url
from content.models import Content
from ingestion.models import IngestionRun, RunStatus
from ingestion.plugins import get_plugin_for_source_config
from projects.models import SourceConfig

logger = logging.getLogger(__name__)


@shared_task(name="core.tasks.run_ingestion")
def run_ingestion(source_config_id: int):
    """Fetch new content for one source config and record an ingestion run."""

    source_config = SourceConfig.objects.select_related("project").get(
        pk=source_config_id
    )
    ingestion_run = IngestionRun.objects.create(
        project=source_config.project,
        plugin_name=source_config.plugin_name,
        status=RunStatus.RUNNING,
    )
    try:
        items_fetched, items_ingested = _ingest_source_config(source_config)
    except Exception as exc:
        ingestion_run.status = RunStatus.FAILED
        ingestion_run.completed_at = timezone.now()
        ingestion_run.error_message = str(exc)
        ingestion_run.save(update_fields=["status", "completed_at", "error_message"])
        logger.exception(
            "Source ingestion failed", extra={"source_config_id": source_config_id}
        )
        raise

    ingestion_run.status = RunStatus.SUCCESS
    ingestion_run.completed_at = timezone.now()
    ingestion_run.items_fetched = items_fetched
    ingestion_run.items_ingested = items_ingested
    ingestion_run.save(
        update_fields=["status", "completed_at", "items_fetched", "items_ingested"]
    )
    return {"items_fetched": items_fetched, "items_ingested": items_ingested}


@shared_task(name="core.tasks.run_all_ingestions")
def run_all_ingestions():
    """Queue ingestion for every active source configuration."""

    source_config_ids = list(
        SourceConfig.objects.filter(is_active=True).values_list("id", flat=True)
    )
    for source_config_id in source_config_ids:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            run_ingestion(source_config_id)
        else:
            run_ingestion.delay(source_config_id)
    return len(source_config_ids)


def _ingest_source_config(source_config: SourceConfig) -> tuple[int, int]:
    """Fetch items from a configured source and create new content rows."""

    plugin = get_plugin_for_source_config(source_config)
    fetched_items = plugin.fetch_new_content(source_config.last_fetched_at)
    ingested_count = 0
    for item in fetched_items:
        if _content_exists_for_item(source_config, item):
            continue
        source_metadata = getattr(item, "source_metadata", None) or {}
        content = Content.objects.create(
            project=source_config.project,
            entity=_match_entity_for_item(plugin, item),
            url=item.url,
            canonical_url=canonicalize_url(item.url),
            title=item.title[:512],
            author=item.author[:255],
            source_plugin=item.source_plugin,
            published_date=item.published_date,
            content_text=item.content_text,
            source_metadata=source_metadata,
        )
        _schedule_content_processing(content)
        ingested_count += 1
    source_config.last_fetched_at = timezone.now()
    source_config.save(update_fields=["last_fetched_at"])
    return len(fetched_items), ingested_count


def _content_exists_for_item(source_config: SourceConfig, item) -> bool:
    """Check whether a fetched item already exists for the project."""

    source_metadata = getattr(item, "source_metadata", None) or {}
    native_item_uri = source_metadata.get("post_uri") or source_metadata.get(
        "status_uri"
    )
    if native_item_uri:
        return (
            Content.objects.filter(
                project=source_config.project,
                source_plugin=item.source_plugin,
            )
            .filter(
                Q(source_metadata__post_uri=native_item_uri)
                | Q(source_metadata__status_uri=native_item_uri)
            )
            .exists()
        )
    canonical_url = canonicalize_url(item.url)
    return (
        Content.objects.filter(
            project=source_config.project,
            source_plugin=item.source_plugin,
        )
        .filter(Q(canonical_url=canonical_url) | Q(url=item.url))
        .exists()
    )


def _match_entity_for_item(plugin, item):
    """Resolve the entity for an item while preserving older plugin mocks."""

    if callable(getattr(type(plugin), "match_entity_for_item", None)):
        return plugin.match_entity_for_item(item)
    return plugin.match_entity_for_url(item.url)


def _schedule_content_processing(content: Content) -> None:
    """Ensure a content row is embedded before it enters the AI pipeline."""

    from core.embeddings import upsert_content_embedding
    from core.tasks import process_content
    from trends.tasks import assign_content_to_topic_cluster

    upsert_content_embedding(content)
    assign_content_to_topic_cluster(content.id)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        process_content(content.id)
    else:
        process_content.delay(content.id)
