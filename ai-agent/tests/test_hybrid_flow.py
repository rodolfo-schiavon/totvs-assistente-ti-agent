"""Legal workspace — documental routing (no operational hybrid)."""

from services.intent_router import route_query


def test_documental_only_route():
    d = route_query("compare cláusulas de SLA do contrato com obrigações das partes")
    assert d.route == "documental"
    assert d.allowed_tool_names == []
