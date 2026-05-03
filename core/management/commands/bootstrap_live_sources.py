"""Bootstrap real RSS and Reddit sources for local development."""

from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ingestion.tasks import run_ingestion
from projects.model_support import SourcePluginName
from projects.models import Project, SourceConfig


class Command(BaseCommand):
    help = (
        "Create or reactivate RSS and Reddit source configs for one project, "
        "optionally queueing ingestion immediately."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--project-id",
            type=int,
            help="Project ID that should own the bootstrapped source configs.",
        )
        parser.add_argument(
            "--project-name",
            help="Project name that should own the bootstrapped source configs.",
        )
        parser.add_argument(
            "--rss-feed",
            action="append",
            default=[],
            help=(
                "RSS feed URL to add. Repeat the flag or pass a comma-separated list."
            ),
        )
        parser.add_argument(
            "--subreddit",
            action="append",
            default=[],
            help=("Subreddit to add. Repeat the flag or pass a comma-separated list."),
        )
        parser.add_argument(
            "--reddit-listing",
            default="both",
            choices=("new", "hot", "both"),
            help="Listing mode to use for bootstrapped Reddit sources.",
        )
        parser.add_argument(
            "--reddit-limit",
            type=int,
            default=25,
            help="Per-listing fetch limit for bootstrapped Reddit sources.",
        )
        parser.add_argument(
            "--run-now",
            action="store_true",
            help="Queue ingestion immediately for every source config touched.",
        )

    def handle(self, *args, **options):
        project = self._get_project(options)
        rss_feeds = self._split_values(options["rss_feed"])
        subreddits = self._split_values(options["subreddit"])
        reddit_limit = int(options["reddit_limit"])

        if reddit_limit <= 0:
            raise CommandError("--reddit-limit must be a positive integer.")
        if not rss_feeds and not subreddits:
            raise CommandError(
                "Provide at least one --rss-feed or --subreddit value to bootstrap."
            )

        created_count = 0
        reactivated_count = 0
        updated_count = 0
        touched_source_ids: list[int] = []

        for feed_url in rss_feeds:
            source_config, outcome = self._upsert_rss_source(project, feed_url)
            touched_source_ids.append(int(source_config.pk))
            if outcome == "created":
                created_count += 1
            elif outcome == "reactivated":
                reactivated_count += 1
            elif outcome == "updated":
                updated_count += 1

        for subreddit in subreddits:
            source_config, outcome = self._upsert_reddit_source(
                project,
                subreddit,
                listing=options["reddit_listing"],
                limit=reddit_limit,
            )
            touched_source_ids.append(int(source_config.pk))
            if outcome == "created":
                created_count += 1
            elif outcome == "reactivated":
                reactivated_count += 1
            elif outcome == "updated":
                updated_count += 1

        queued_count = 0
        if options["run_now"]:
            for source_config_id in touched_source_ids:
                if settings.CELERY_TASK_ALWAYS_EAGER:
                    run_ingestion(source_config_id)
                else:
                    run_ingestion.delay(source_config_id)
                queued_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Bootstrapped {len(touched_source_ids)} source config(s) for project {project.name}."
            )
        )
        self.stdout.write(f"Created: {created_count}")
        self.stdout.write(f"Reactivated: {reactivated_count}")
        self.stdout.write(f"Updated: {updated_count}")
        if options["run_now"]:
            self.stdout.write(f"Queued ingestions: {queued_count}")

    def _get_project(self, options) -> Project:
        """Resolve the project from either ID or exact name."""

        project_id = options.get("project_id")
        project_name = (options.get("project_name") or "").strip()
        if bool(project_id) == bool(project_name):
            raise CommandError("Pass exactly one of --project-id or --project-name.")

        if project_id:
            try:
                return Project.objects.get(pk=project_id)
            except Project.DoesNotExist as exc:
                raise CommandError(
                    f"Project with id {project_id} does not exist."
                ) from exc

        try:
            return Project.objects.get(name=project_name)
        except Project.DoesNotExist as exc:
            raise CommandError(
                f"Project named '{project_name}' does not exist."
            ) from exc

    @staticmethod
    def _split_values(raw_values: list[str]) -> list[str]:
        """Split repeated or comma-delimited CLI values into a clean list."""

        normalized_values: list[str] = []
        seen_values: set[str] = set()
        for raw_value in raw_values:
            for item in raw_value.split(","):
                normalized_item = item.strip()
                if not normalized_item or normalized_item in seen_values:
                    continue
                seen_values.add(normalized_item)
                normalized_values.append(normalized_item)
        return normalized_values

    def _upsert_rss_source(
        self,
        project: Project,
        feed_url: str,
    ) -> tuple[SourceConfig, str]:
        """Create or reactivate one RSS source config."""

        source_config = SourceConfig.objects.filter(
            project=project,
            plugin_name=SourcePluginName.RSS,
            config__feed_url=feed_url,
        ).first()
        if source_config is None:
            source_config = SourceConfig.objects.create(
                project=project,
                plugin_name=SourcePluginName.RSS,
                config={"feed_url": feed_url},
                is_active=True,
            )
            return source_config, "created"
        if not source_config.is_active:
            source_config.is_active = True
            source_config.save(update_fields=["is_active"])
            return source_config, "reactivated"
        return source_config, "unchanged"

    def _upsert_reddit_source(
        self,
        project: Project,
        subreddit: str,
        *,
        listing: str,
        limit: int,
    ) -> tuple[SourceConfig, str]:
        """Create, reactivate, or refresh one Reddit source config."""

        desired_config = {
            "subreddit": subreddit,
            "listing": listing,
            "limit": limit,
        }
        source_config = SourceConfig.objects.filter(
            project=project,
            plugin_name=SourcePluginName.REDDIT,
            config__subreddit=subreddit,
        ).first()
        if source_config is None:
            source_config = SourceConfig.objects.create(
                project=project,
                plugin_name=SourcePluginName.REDDIT,
                config=desired_config,
                is_active=True,
            )
            return source_config, "created"

        update_fields: list[str] = []
        outcome = "unchanged"
        if source_config.config != desired_config:
            source_config.config = desired_config
            update_fields.append("config")
            outcome = "updated"
        if not source_config.is_active:
            source_config.is_active = True
            update_fields.append("is_active")
            outcome = "reactivated" if outcome == "unchanged" else outcome
        if update_fields:
            source_config.save(update_fields=update_fields)
        return source_config, outcome
