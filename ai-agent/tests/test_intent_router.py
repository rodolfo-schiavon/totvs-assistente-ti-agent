"""Tests for intent routing — Assistente TI."""

from services.intent_router import route_query


def test_operational_cluster():
    d = route_query("Como está o cluster?")
    assert d.route == "operational"


def test_analytical_metrics():
    d = route_query("Qual a latência P95 do gateway?")
    assert d.route in ("analytical", "operational")


def test_knowledge_mode_documental():
    d = route_query("consulte a base", knowledge_mode=True)
    assert d.route == "documental"
    assert d.prefetch_kb is True


def test_docs_route():
    d = route_query("como funciona o gitops na plataforma?")
    assert d.route == "documental"
