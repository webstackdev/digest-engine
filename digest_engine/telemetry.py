"""Optional OpenTelemetry bootstrap and tracing helpers."""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Iterator, Mapping

from django.conf import settings

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from opentelemetry.trace import TracerProvider as ApiTracerProvider

_PROVIDER_CONFIGURED = False
_DJANGO_INSTRUMENTED = False
_CELERY_INSTRUMENTED = False
_DEPENDENCY_WARNING_EMITTED = False


def _telemetry_enabled() -> bool:
    """Return whether OTLP-backed telemetry export is enabled."""

    return bool(
        getattr(settings, "OTEL_ENABLED", False)
        and getattr(settings, "OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    )


def _parse_otlp_headers(raw_headers: str) -> dict[str, str]:
    """Parse OTLP exporter headers from a comma-separated env string."""

    headers: dict[str, str] = {}
    for raw_header in raw_headers.split(","):
        key, separator, value = raw_header.partition("=")
        if not separator:
            continue
        header_key = key.strip()
        if not header_key:
            continue
        headers[header_key] = value.strip()
    return headers


def _warn_missing_dependencies() -> None:
    """Log one warning when OTEL is enabled but dependencies are unavailable."""

    global _DEPENDENCY_WARNING_EMITTED
    if _DEPENDENCY_WARNING_EMITTED:
        return
    logger.warning(
        "OpenTelemetry is enabled but dependencies are not installed; skipping instrumentation."
    )
    _DEPENDENCY_WARNING_EMITTED = True


def configure_telemetry(
    *,
    instrument_django: bool = False,
    celery_app: object | None = None,
) -> bool:
    """Configure OTLP tracing and instrument supported runtimes when enabled."""

    if not _telemetry_enabled():
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.celery import CeleryInstrumentor
        from opentelemetry.instrumentation.django import DjangoInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ModuleNotFoundError:
        _warn_missing_dependencies()
        return False

    global _PROVIDER_CONFIGURED, _DJANGO_INSTRUMENTED, _CELERY_INSTRUMENTED

    if not _PROVIDER_CONFIGURED:
        resource = Resource.create(
            {
                "service.name": settings.OTEL_SERVICE_NAME,
                "service.namespace": settings.OTEL_SERVICE_NAMESPACE,
            }
        )
        sdk_tracer_provider = TracerProvider(resource=resource)
        sdk_tracer_provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(
                    endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
                    headers=_parse_otlp_headers(settings.OTEL_EXPORTER_OTLP_HEADERS),
                    timeout=settings.OTEL_EXPORTER_OTLP_TIMEOUT_SECONDS,
                )
            )
        )
        trace.set_tracer_provider(sdk_tracer_provider)
        _PROVIDER_CONFIGURED = True

    tracer_provider: ApiTracerProvider = trace.get_tracer_provider()

    if instrument_django and not _DJANGO_INSTRUMENTED:
        DjangoInstrumentor().instrument(tracer_provider=tracer_provider)
        _DJANGO_INSTRUMENTED = True

    if celery_app is not None and not _CELERY_INSTRUMENTED:
        CeleryInstrumentor().instrument(
            tracer_provider=tracer_provider,
            skip_dep_check=True,
        )
        _CELERY_INSTRUMENTED = True

    return True


def current_trace_context() -> dict[str, str]:
    """Return the current trace and span ids when a span is active."""

    try:
        from opentelemetry import trace
    except ModuleNotFoundError:
        return {}

    span = trace.get_current_span()
    span_context = span.get_span_context()
    if not span_context.is_valid:
        return {}
    return {
        "trace_id": format(span_context.trace_id, "032x"),
        "span_id": format(span_context.span_id, "016x"),
    }


def _coerce_attribute_value(value: object) -> bool | int | float | str:
    """Normalize span attribute values to supported scalar types."""

    if isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


@contextmanager
def trace_span(
    name: str,
    *,
    attributes: Mapping[str, Any] | None = None,
) -> Iterator[object | None]:
    """Create a best-effort tracing span around one unit of work."""

    try:
        from opentelemetry import trace
    except ModuleNotFoundError:
        yield None
        return

    tracer = trace.get_tracer("digest_engine")
    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, value in attributes.items():
                if value is None:
                    continue
                span.set_attribute(key, _coerce_attribute_value(value))
        yield span
