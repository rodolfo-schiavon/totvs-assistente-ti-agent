"""Assistente TI — routing smoke tests."""

from services.intent_router import route_query


def test_documental_default_for_general_questions():
    d = route_query("explique a arquitetura gitops do lab")
    assert d.route == "documental"
    assert d.allowed_tool_names == []
