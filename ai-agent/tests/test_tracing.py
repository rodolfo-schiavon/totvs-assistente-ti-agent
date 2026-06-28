import os

import pytest

from app import tracing


@pytest.fixture(autouse=True)
def _clear_tracing_env(monkeypatch):
    for key in (
        "LANGSMITH_TRACING",
        "LANGSMITH_TRACING_V2",
        "LANGCHAIN_TRACING_V2",
        "LANGCHAIN_TRACING",
        "LANGSMITH_API_KEY",
        "LANGCHAIN_API_KEY",
        "LANGSMITH_PROJECT",
        "LANGCHAIN_PROJECT",
        "LANGSMITH_ENDPOINT",
        "LANGCHAIN_ENDPOINT",
        "LANGSMITH_WORKSPACE_ID",
        "LANGCHAIN_WORKSPACE_ID",
        "LANGSMITH_VERIFY",
    ):
        monkeypatch.delenv(key, raising=False)


def test_langsmith_tracing_only_enables_with_api_key(monkeypatch):
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    monkeypatch.setenv("LANGSMITH_API_KEY", "lsv2_test_key")
    monkeypatch.setenv("LANGSMITH_PROJECT", '"Dashboard"')
    monkeypatch.setenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
    monkeypatch.setenv("LANGSMITH_WORKSPACE_ID", "ws-123")
    monkeypatch.setenv("LANGSMITH_VERIFY", "false")

    assert tracing.configure_tracing() is True
    assert os.environ["LANGCHAIN_TRACING_V2"] == "true"
    assert os.environ["LANGSMITH_TRACING"] == "true"
    assert os.environ["LANGCHAIN_API_KEY"] == "lsv2_test_key"
    assert os.environ["LANGSMITH_API_KEY"] == "lsv2_test_key"
    assert os.environ["LANGCHAIN_PROJECT"] == "Dashboard"
    assert os.environ["LANGSMITH_PROJECT"] == "Dashboard"
    assert os.environ["LANGSMITH_WORKSPACE_ID"] == "ws-123"


def test_langchain_tracing_v2_still_works(monkeypatch):
    monkeypatch.setenv("LANGCHAIN_TRACING_V2", "true")
    monkeypatch.setenv("LANGCHAIN_API_KEY", "lsv2_legacy")
    monkeypatch.setenv("LANGSMITH_VERIFY", "false")

    assert tracing.configure_tracing() is True
    assert os.environ["LANGSMITH_TRACING"] == "true"
    assert os.environ["LANGSMITH_API_KEY"] == "lsv2_legacy"


def test_missing_api_key_returns_false(monkeypatch):
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    assert tracing.configure_tracing() is False


def test_auto_resolve_workspace(monkeypatch):
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    monkeypatch.setenv("LANGSMITH_API_KEY", "lsv2_test_key")
    monkeypatch.setenv("LANGSMITH_VERIFY", "false")

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return [{"id": "ws-auto", "display_name": "Workspace 1"}]

    monkeypatch.setattr(tracing.httpx, "get", lambda *a, **k: FakeResponse())

    assert tracing.configure_tracing() is True
    assert os.environ["LANGSMITH_WORKSPACE_ID"] == "ws-auto"


def test_get_tracing_status():
    status = tracing.get_tracing_status()
    assert "enabled" in status
    assert "has_api_key" in status
    assert "has_workspace_id" in status
