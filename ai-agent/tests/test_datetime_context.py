from datetime import datetime
from zoneinfo import ZoneInfo

from services.datetime_context import build_datetime_context


def test_datetime_context_contains_key_references():
    ref = datetime(2026, 5, 22, 14, 30, tzinfo=ZoneInfo("America/Sao_Paulo"))
    ctx = build_datetime_context(ref)
    assert "Hoje: 22/05/2026" in ctx
    assert "Ontem: 21/05/2026" in ctx
    assert "Amanhã: 23/05/2026" in ctx
    assert "Ano passado (2025)" in ctx
    assert 'period_preset' in ctx
    assert "Próximo mês" in ctx
