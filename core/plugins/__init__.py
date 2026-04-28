"""Public plugin-registry helpers used by the rest of the application."""

from core.plugins.registry import get_plugin_for_source_config, validate_plugin_config

__all__ = ["get_plugin_for_source_config", "validate_plugin_config"]
