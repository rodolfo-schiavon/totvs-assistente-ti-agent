"""Tests for intent routing — Legal AI (documental only)."""

from services.intent_router import route_query


def test_always_documental():
    d = route_query("quais riscos neste contrato?")
    assert d.route == "documental"
    assert d.confidence == 1.0


def test_knowledge_mode_prefetch():
    d = route_query("consulte a base de conhecimento", knowledge_mode=True)
    assert d.route == "documental"
    assert d.prefetch_kb is True


def test_no_analytics_tools():
    d = route_query("quantos chamados abertos?")
    assert d.allowed_tool_names == []
