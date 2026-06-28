import pytest

from app import otel_tracing


def test_otel_disabled_without_env(monkeypatch):
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    monkeypatch.delenv("OTEL_TRACING_ENABLED", raising=False)
    otel_tracing._configured = False
    otel_tracing._tracer = None
    assert otel_tracing.otel_requested() is False
    assert otel_tracing.configure_otel() is False
    assert otel_tracing.get_otel_status()["enabled"] is False


def test_otel_requested_with_endpoint(monkeypatch):
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4317")
    assert otel_tracing.otel_requested() is True


def test_otel_enabled_with_endpoint(monkeypatch):
    pytest.importorskip("opentelemetry.sdk")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4317")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_INSECURE", "true")
    otel_tracing._configured = False
    otel_tracing._tracer = None
    assert otel_tracing.configure_otel() is True
    assert otel_tracing.get_otel_status()["enabled"] is True


class _FakeSpan:
    def __init__(self):
        self.attributes: dict[str, object] = {}
        self.status = None

    def set_attribute(self, key, value):
        self.attributes[key] = value

    def set_status(self, status):
        self.status = status


def test_record_turn_metrics_sets_langfuse_io():
    span = _FakeSpan()
    otel_tracing.record_turn_metrics(
        span,
        route="rag",
        latency_ms=120,
        input_tokens=10,
        output_tokens=20,
        estimated_cost_usd=0.001,
        model="gpt-4o-mini",
        provider="openai",
        user_message="Qual o prazo?",
        assistant_output="O prazo é 30 dias.",
    )
    assert span.attributes["langfuse.trace.input"] == "Qual o prazo?"
    assert span.attributes["langfuse.trace.output"] == "O prazo é 30 dias."
    assert span.attributes["gen_ai.prompt"] == "Qual o prazo?"
    assert span.attributes["gen_ai.completion"] == "O prazo é 30 dias."
    assert span.attributes["langfuse.observation.type"] == "generation"
    assert span.attributes["llm.input_tokens"] == 10


def test_record_turn_metrics_truncates_long_content(monkeypatch):
    monkeypatch.setattr(otel_tracing, "_MAX_ATTR_LEN", 50)
    span = _FakeSpan()
    long_text = "x" * 100
    otel_tracing.record_turn_metrics(
        span,
        route=None,
        latency_ms=1,
        user_message=long_text,
    )
    stored = span.attributes["langfuse.trace.input"]
    assert len(stored) <= 50
    assert "truncado" in stored
