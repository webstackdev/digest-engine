from http import HTTPStatus
from typing import Any, cast

from django.contrib.auth import get_user_model
from django.db.models import Model
from django.test import TestCase
from django.urls import reverse

from projects.model_support import SourcePluginName
from projects.models import Project, ProjectMembership, ProjectRole, SourceConfig


def _require_pk(instance: Model) -> int:
    """Return a saved model primary key for typed API test assertions."""
    instance_pk = instance.pk
    if instance_pk is None:
        raise ValueError(f"{instance.__class__.__name__} must be saved first.")
    return int(instance_pk)


def _create_user(user_model: type[Any], **kwargs: object):
    return cast(Any, user_model.objects).create_user(**kwargs)


class SourceConfigNinjaApiTests(TestCase):
    """Exercise source configurations Ninja API endpoints."""

    def setUp(self):
        user_model = get_user_model()
        self.owner = _create_user(user_model, username="owner", password="testpass123")
        self.reader = _create_user(
            user_model, username="reader", password="testpass123"
        )

        self.owner_project = Project.objects.create(
            name="Owner Project",
            topic_description="Platform engineering",
        )

        ProjectMembership.objects.create(
            user=self.owner,
            project=self.owner_project,
            role=ProjectRole.ADMIN,
        )
        ProjectMembership.objects.create(
            user=self.reader,
            project=self.owner_project,
            role=ProjectRole.READER,
        )
        self.client.login(username="owner", password="testpass123")

    def test_list_source_configs(self):
        SourceConfig.objects.create(
            project=self.owner_project,
            plugin_name=SourcePluginName.RSS,
            config={"feed_url": "https://example.com/feed.xml"},
        )
        response = self.client.get(
            reverse(
                "ninja-api:list_source_configs",
                kwargs={"project_id": _require_pk(self.owner_project)},
            )
        )
        self.assertEqual(response.status_code, HTTPStatus.OK)
        # Should be exactly 1
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["plugin_name"], SourcePluginName.RSS)

    def test_create_source_config(self):
        response = self.client.post(
            reverse(
                "ninja-api:create_source_config",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {
                "plugin_name": SourcePluginName.RSS,
                "config": {"feed_url": "https://example.com/feed.xml"},
                "is_active": True,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, HTTPStatus.CREATED)
        config = SourceConfig.objects.get(project=self.owner_project)
        self.assertEqual(config.plugin_name, SourcePluginName.RSS)
        self.assertEqual(
            config.config,
            {"feed_url": "https://example.com/feed.xml"},
        )
        self.assertTrue(response.json()["is_active"])

    def test_create_source_config_rejects_invalid_plugin_config(self):
        response = self.client.post(
            reverse(
                "ninja-api:create_source_config",
                kwargs={"project_id": _require_pk(self.owner_project)},
            ),
            {"plugin_name": SourcePluginName.RSS, "config": {}},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(
            response.json()["config"][0],
            "Invalid source configuration.",
        )

    def test_update_source_config_revalidates_and_normalizes_plugin_config(self):
        config = SourceConfig.objects.create(
            project=self.owner_project,
            plugin_name=SourcePluginName.BLUESKY,
            config={"author_handle": "owner.bsky.social"},
        )

        response = self.client.patch(
            reverse(
                "ninja-api:update_source_config",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "config_id": _require_pk(config),
                },
            ),
            {"config": {"author_handle": "@Alice.BSKY.social"}},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        config.refresh_from_db()
        self.assertEqual(
            config.config,
            {
                "author_handle": "alice.bsky.social",
                "include_replies": False,
                "max_posts_per_fetch": 100,
            },
        )
        self.assertEqual(
            response.json()["config"]["author_handle"], "alice.bsky.social"
        )

    def test_reader_cannot_delete(self):
        config = SourceConfig.objects.create(
            project=self.owner_project,
            plugin_name=SourcePluginName.REDDIT,
            config={"subreddit": "MachineLearning"},
        )
        self.client.login(username="reader", password="testpass123")
        response = self.client.delete(
            reverse(
                "ninja-api:delete_source_config",
                kwargs={
                    "project_id": _require_pk(self.owner_project),
                    "config_id": _require_pk(config),
                },
            )
        )
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
