"""Compatibility wrappers for the ingestion plugin registry."""

from ingestion.plugins import get_plugin_for_source_config, validate_plugin_config

__all__ = ["get_plugin_for_source_config", "validate_plugin_config"]
