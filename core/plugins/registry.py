from typing import Any

from core.models import SourcePluginName
from core.plugins.reddit import RedditSourcePlugin
from core.plugins.rss import RSSSourcePlugin

PLUGIN_REGISTRY = {
    SourcePluginName.RSS: RSSSourcePlugin,
    SourcePluginName.REDDIT: RedditSourcePlugin,
}


def get_plugin_for_source_config(source_config):
    return _get_plugin_class(source_config.plugin_name)(source_config)


def validate_plugin_config(
    plugin_name: SourcePluginName | str, config: object
) -> dict[str, Any]:
    return _get_plugin_class(plugin_name).validate_config(config)


def _get_plugin_class(plugin_name: SourcePluginName | str):
    try:
        return PLUGIN_REGISTRY[SourcePluginName(plugin_name)]
    except KeyError as exc:
        raise ValueError(f"Unsupported source plugin: {plugin_name}") from exc
    except ValueError as exc:
        raise ValueError(f"Unsupported source plugin: {plugin_name}") from exc
