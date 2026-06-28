"""OpenTelemetry — export OTLP gRPC para o collector do cluster."""

from __future__ import annotations

import json
import logging
import os
from contextlib import contextmanager
from typing import Any, Iterator

logger = logging.getLogger(__name__)

_TRUTHY = frozenset({"true", "1", "yes", "on"})
_MAX_ATTR_LEN = int(os.getenv("OTEL_LANGFUSE_MAX_CONTENT_LEN", "12000"))
_configured = False
_tracer = None


def _truthy(val: str | None) -> bool:
    return (val or "").strip().lower() in _TRUTHY


def _clip(text: str | None, limit: int | None = None) -> str | None:
    if text is None:
        return None
    max_len = _MAX_ATTR_LEN if limit is None else limit
    s = str(text).strip()
    if not s:
        return None
    if len(s) <= max_len:
        return s
    return s[: max_len - 20] + "\n… [truncado]"


def _as_langfuse_payload(text: str | None) -> str | None:
    clipped = _clip(text)
    if clipped is None:
        return None
    return clipped


def otel_requested() -> bool:
    if _truthy(os.getenv("OTEL_TRACING_ENABLED")):
        return True
    return bool(os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip())


def configure_otel() -> bool:
    global _configured, _tracer
    if _configured:
        return _tracer is not None
    _configured = True

    if not otel_requested():
        logger.info(
            "OpenTelemetry desativado (defina OTEL_EXPORTER_OTLP_ENDPOINT ou OTEL_TRACING_ENABLED=true)"
        )
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        logger.warning("Pacotes OpenTelemetry não instalados — tracing OTLP ignorado")
        return False

    service_name = os.getenv("OTEL_SERVICE_NAME", "juridico-ai-agent").strip()
    resource_attrs = os.getenv("OTEL_RESOURCE_ATTRIBUTES", "")
    attributes: dict[str, str] = {"service.name": service_name}
    for part in resource_attrs.split(","):
        part = part.strip()
        if "=" in part:
            key, value = part.split("=", 1)
            attributes[key.strip()] = value.strip()

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    insecure = _truthy(os.getenv("OTEL_EXPORTER_OTLP_INSECURE", "true"))

    resource = Resource.create(attributes)
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=endpoint, insecure=insecure)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer("juridico.ai-agent")
    logger.info("OpenTelemetry ativo — endpoint=%s service=%s", endpoint, service_name)
    return True


def instrument_fastapi(app) -> None:
    if not _tracer:
        return
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app)
        logger.info("FastAPI instrumentado com OpenTelemetry")
    except Exception as exc:
        logger.warning("Falha ao instrumentar FastAPI: %s", exc)


def get_otel_status() -> dict[str, Any]:
    return {
        "enabled": _tracer is not None,
        "endpoint": os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
        "service_name": os.getenv("OTEL_SERVICE_NAME", "juridico-ai-agent"),
    }


def get_tracer():
    return _tracer


@contextmanager
def span_chat_turn(
    *,
    user_id: str,
    conversation_id: str | None,
    analysis_type: str | None,
    stream: bool = False,
) -> Iterator[Any]:
    if not _tracer:
        yield None
        return

    name = "chat.stream" if stream else "chat.turn"
    with _tracer.start_as_current_span(name) as span:
        span.set_attribute("langfuse.trace.name", name)
        span.set_attribute("user.id", user_id)
        span.set_attribute("langfuse.user.id", user_id)
        if conversation_id:
            span.set_attribute("conversation.id", conversation_id)
            span.set_attribute("session.id", conversation_id)
            span.set_attribute("langfuse.session.id", conversation_id)
        if analysis_type:
            span.set_attribute("analysis.type", analysis_type)
        yield span


def record_turn_metrics(
    span,
    *,
    route: str | None,
    latency_ms: int,
    input_tokens: int = 0,
    output_tokens: int = 0,
    estimated_cost_usd: float = 0.0,
    model: str | None = None,
    provider: str | None = None,
    user_message: str | None = None,
    assistant_output: str | None = None,
    error: str | None = None,
) -> None:
    if span is None:
        return

    user_text = _as_langfuse_payload(user_message)
    assistant_text = _as_langfuse_payload(assistant_output)

    if user_text:
        span.set_attribute("langfuse.trace.input", user_text)
        span.set_attribute("langfuse.observation.input", user_text)
        span.set_attribute("gen_ai.prompt", user_text)
        span.set_attribute("input.value", user_text)

    if assistant_text:
        span.set_attribute("langfuse.trace.output", assistant_text)
        span.set_attribute("langfuse.observation.output", assistant_text)
        span.set_attribute("gen_ai.completion", assistant_text)
        span.set_attribute("output.value", assistant_text)

    span.set_attribute("latency.ms", latency_ms)
    span.set_attribute("llm.input_tokens", input_tokens)
    span.set_attribute("llm.output_tokens", output_tokens)
    span.set_attribute("llm.estimated_cost_usd", estimated_cost_usd)

    if model or provider:
        span.set_attribute("langfuse.observation.type", "generation")
        if model:
            span.set_attribute("llm.model", model)
            span.set_attribute("gen_ai.request.model", model)
            span.set_attribute("langfuse.observation.model.name", model)
        if provider:
            span.set_attribute("llm.provider", provider)
            span.set_attribute("gen_ai.system", provider)

    if input_tokens or output_tokens:
        usage = {
            "input": input_tokens,
            "output": output_tokens,
            "total": input_tokens + output_tokens,
            "unit": "TOKENS",
        }
        span.set_attribute("langfuse.observation.usage_details", json.dumps(usage))
        span.set_attribute("gen_ai.usage.prompt_tokens", input_tokens)
        span.set_attribute("gen_ai.usage.completion_tokens", output_tokens)

    if route:
        span.set_attribute("agent.route", route)

    if error:
        err = _clip(error, 500) or error[:500]
        span.set_attribute("error.message", err)
        try:
            from opentelemetry import trace as ot_trace

            span.set_status(ot_trace.Status(ot_trace.StatusCode.ERROR, err[:200]))
        except ImportError:
            pass
    else:
        try:
            from opentelemetry import trace as ot_trace

            span.set_status(ot_trace.Status(ot_trace.StatusCode.OK))
        except ImportError:
            pass
