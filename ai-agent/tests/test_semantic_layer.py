"""Tests for semantic layer schema and tool mapping."""

from services.semantic_layer import (
    catalog_summary,
    describe_entity,
    expand_hybrid_query,
    format_for_prompt,
    load_schema,
    suggest_tools,
    tools_for_route,
)


def test_schema_loads():
    schema = load_schema()
    assert "entities" in schema
    assert "routes" in schema
    assert "tickets" in schema["entities"]


def test_describe_entity_tickets():
    ent = describe_entity("tickets")
    assert ent is not None
    assert "search_tickets" in ent.get("tools", [])


def test_tools_for_operational_route():
    tools = tools_for_route("operational")
    assert "get_tickets_summary" in tools
    assert "search_knowledge_base" not in tools


def test_tools_for_hybrid_route():
    tools = tools_for_route("hybrid")
    assert "search_knowledge_base" not in tools
    assert "get_sla_breaches" in tools


def test_tools_for_documental_route_empty():
    tools = tools_for_route("documental")
    assert tools == []


def test_suggest_tools_for_sla_question():
    tools = suggest_tools("quais chamados violaram SLA?", route="operational")
    assert "get_sla_breaches" in tools or "get_tickets_summary" in tools


def test_format_for_prompt_includes_route():
    text = format_for_prompt("hybrid")
    assert "hybrid" in text.lower()
    assert "Tools" in text or "legal-kb" in text.lower()


def test_expand_hybrid_query_adds_sla_terms():
    expanded = expand_hybrid_query("o chamado cumpre SLA?")
    assert "SLA" in expanded


def test_catalog_summary_mentions_limitation():
    summary = catalog_summary()
    assert "import" in summary.lower() or "Spiceworks" in summary
