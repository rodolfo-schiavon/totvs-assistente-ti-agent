"""Tests for LLM gateway routing in build_llm."""

import os

import pytest

pytest.importorskip("langchain_anthropic")
pytest.importorskip("langchain_openai")

from app import llm_provider


def test_build_llm_uses_gateway_when_env_set(monkeypatch):
    monkeypatch.setenv("LLM_GATEWAY_BASE_URL", "http://llm-gateway.platform.svc:8080")
    monkeypatch.setenv("LLM_GATEWAY_TOKEN", "test-token")
    llm = llm_provider.build_llm(
        {"provider": "anthropic", "model": "claude-haiku-4-5-20251001", "apiKey": "sk-old"},
    )
    assert llm.__class__.__name__ == "ChatOpenAI"
    assert llm.streaming is False


def test_build_llm_direct_anthropic_without_gateway(monkeypatch):
    monkeypatch.delenv("LLM_GATEWAY_BASE_URL", raising=False)
    llm = llm_provider.build_llm(
        {"provider": "anthropic", "model": "claude-haiku-4-5-20251001", "apiKey": "sk-test"},
    )
    assert llm.__class__.__name__ == "ChatAnthropic"
