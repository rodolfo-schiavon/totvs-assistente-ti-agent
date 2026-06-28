"""Tests for knowledge routing heuristics."""

from app.knowledge_context import looks_like_analytics, looks_like_kb_meta, should_prefetch_knowledge


def test_magic_question_prefetches_kb():
    assert should_prefetch_knowledge("como jogar magic?", False) is True
    assert looks_like_analytics("como jogar magic?") is False


def test_ticket_question_is_analytics():
    assert looks_like_analytics("quantos chamados abertos temos?") is True
    assert should_prefetch_knowledge("quantos chamados abertos temos?", False) is False


def test_list_documents_meta():
    assert looks_like_kb_meta("quais documentos possuem na base de conhecimento?") is True
    assert should_prefetch_knowledge("quais documentos possuem na base de conhecimento?", False) is True


def test_knowledge_mode_always_prefetch():
    assert should_prefetch_knowledge("quantos chamados abertos?", True) is True
