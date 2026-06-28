"""Tests for prompt registry loader."""

from services import prompt_registry


def test_fallback_system_prompt():
    prompt = prompt_registry.get_prompt("system")
    assert "Assistente de TI" in prompt or "plataforma" in prompt.lower()


def test_build_main_includes_kb_path():
    prompt = prompt_registry.build_main_system_prompt("/platform-kb/")
    assert "/platform-kb/" in prompt
