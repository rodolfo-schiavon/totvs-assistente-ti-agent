"""Tests for MixedResponse enrichment (sources, follow-ups)."""

from app.schemas import MixedResponse
from services.response_enrichment import build_follow_ups, build_sources, enrich_mixed_response
from services.tool_observability import extract_tool_calls, tools_to_source_type


def test_build_sources_hybrid():
    sources = build_sources("hybrid", ["task", "read_file", "get_sla_breaches"])
    assert sources[0].type == "hybrid"
    assert "conhecimento" in sources[0].label.lower() or "híbrido" in sources[0].label.lower()


def test_build_sources_knowledge_only():
    sources = build_sources("documental", ["grep", "read_file"])
    assert sources[0].type == "knowledge"


def test_build_follow_ups_contract_context():
    ups = build_follow_ups("documental", "revise as cláusulas deste contrato")
    assert len(ups) == 3
    assert any("cláusula" in u.lower() for u in ups)


def test_enrich_mixed_response_adds_fields():
    mixed = MixedResponse(markdown="Resposta teste")
    enriched = enrich_mixed_response(mixed, "operational", ["get_tickets_summary"])
    assert enriched.route == "operational"
    assert enriched.sources
    assert enriched.follow_ups
    assert enriched.data_limitations is not None


def test_tools_to_source_type():
    assert tools_to_source_type(["grep", "read_file"]) == "knowledge"
    assert tools_to_source_type(["get_tickets_summary"]) == "system"
    assert tools_to_source_type(["task", "get_sla_breaches"]) == "hybrid"
    assert tools_to_source_type([], "documental") == "knowledge"
    assert tools_to_source_type([], "operational") == "system"


def test_build_sources_documental_without_tools():
    sources = build_sources("documental", [], kb_prefetch=False)
    assert sources[0].type == "knowledge"
    assert "conhecimento" in sources[0].label.lower()


def test_extract_tool_calls_empty():
    assert extract_tool_calls([]) == []
