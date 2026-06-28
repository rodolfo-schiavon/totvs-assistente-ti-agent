"""Tests for Deep Agent message extraction helpers."""

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from app.graph import (
    _extract_final_text,
    _is_internal_researcher_report,
    _is_tool_planning_chatter,
    _looks_like_tool_json,
    _pick_response_text,
)


def test_is_internal_researcher_report():
    assert _is_internal_researcher_report("Achados principais\nEvidências com paths\nPontos de incerteza")
    assert not _is_internal_researcher_report("Um deck construído precisa de no mínimo 60 cartas.")


def test_looks_like_tool_json():
    assert _looks_like_tool_json('{"tool": "read_file"}') is True
    assert _looks_like_tool_json("Resposta normal.") is False


def test_extract_final_text_from_ai_message():
    messages = [
        HumanMessage(content="pergunta"),
        AIMessage(content="Resposta documentada com citação."),
    ]
    assert _extract_final_text(messages) == "Resposta documentada com citação."


def test_is_tool_planning_chatter():
    assert _is_tool_planning_chatter("Deixe-me criar o contrato agora:")
    assert not _is_tool_planning_chatter(
        "## Contrato de Prestação de Serviços\n\nCláusula 1 — Das partes..."
    )


def test_pick_response_text_prefers_extracted_over_chatter():
    report = "Deixe-me criar o contrato agora:Vou estruturar o contrato corretamente:"
    messages = [
        HumanMessage(content="crie contrato"),
        AIMessage(content="## Minuta\n\nContrato completo em markdown."),
    ]
    assert _pick_response_text([report], messages).startswith("## Minuta")


def test_extract_final_text_skips_researcher_report():
    report = (
        "**Achados principais**\n- Nada encontrado\n"
        "**Evidências com paths**\n- /legal-kb/x.txt\n"
        "**Pontos de incerteza**\n- Talvez não exista"
    )
    messages = [
        HumanMessage(content="pergunta"),
        ToolMessage(content=report, tool_call_id="1"),
    ]
    assert _extract_final_text(messages) == ""
