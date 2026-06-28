"""Tests for Deep Agent prompts (Legal AI Workspace)."""

from app.deep_prompts import build_main_system_prompt, build_researcher_system_prompt


def test_researcher_prompt_requires_ls_grep_read():
    prompt = build_researcher_system_prompt()
    assert "ls" in prompt
    assert "grep" in prompt
    assert "read_file" in prompt
    assert "/legal-kb/" in prompt


def test_main_prompt_legal_disclaimer():
    prompt = build_main_system_prompt(analysis_type="revisao_juridica")
    assert "advogado" in prompt.lower()
    assert "revisão jurídica" in prompt.lower() or "revisao_juridica" in prompt


def test_main_prompt_knowledge_path():
    prompt = build_main_system_prompt(analysis_type="geral")
    assert "researcher" in prompt.lower()
    assert "/legal-kb/" in prompt
