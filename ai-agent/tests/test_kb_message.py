"""Tests for KB message normalization and VFS excerpt helpers."""

from app.graph import _normalize_kb_message


def test_normalize_generic_kb_message():
    msg = _normalize_kb_message("Conversar com documentos da base de conhecimento", True)
    assert "/legal-kb/" in msg
    assert "Liste" in msg


def test_normalize_keeps_specific_question():
    q = "O que diz o documento sobre SLA de 4 horas?"
    assert _normalize_kb_message(q, True) == q


def test_normalize_skips_when_not_knowledge_mode():
    msg = "Conversar com documentos da base de conhecimento"
    assert _normalize_kb_message(msg, False) == msg
