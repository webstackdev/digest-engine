import logging
import os

import structlog

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


def _add_trace_context(_, __, event_dict):
    """Attach active trace identifiers to structured logs when available."""

    from digest_engine.telemetry import current_trace_context

    event_dict.update(current_trace_context())
    return event_dict


# Structlog: application logs are rendered as JSON so log aggregation systems
# can parse fields like level, timestamp, and exception data reliably.
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        _add_trace_context,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    ),
    cache_logger_on_first_use=True,
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.processors.JSONRenderer(),
            "foreign_pre_chain": [
                structlog.contextvars.merge_contextvars,
                _add_trace_context,
                structlog.processors.add_log_level,
                structlog.processors.TimeStamper(fmt="iso", utc=True),
            ],
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        }
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
}

__all__ = ["LOG_LEVEL", "LOGGING"]
