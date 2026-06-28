"""Tests for document citation cleanup."""

from services.document_citations import (
    clean_documental_markdown,
    path_to_display_name,
    prepare_documental_response,
)


def test_path_to_display_name():
    name = path_to_display_name("/legal-kb/the-gathering-rules-cmpss5i6.txt")
    assert "Gathering" in name
    assert "cmpss5i6" not in name


def test_clean_removes_inline_paths_and_lines():
    raw = (
        "Para jogar:\n\n"
        "* **Jogo Construído:** mínimo de 60 cartas "
        "(conforme `/legal-kb/the-gathering-rules-cmpss5i6.txt`, linha 206).\n"
        "* **Limitado:** 40 cartas (conforme `/legal-kb/foo.txt`, linha 208)."
    )
    cleaned = clean_documental_markdown(raw)
    assert "/legal-kb/" not in cleaned
    assert "linha 206" not in cleaned
    assert "60 cartas" in cleaned


def test_clean_preserves_gfm_tables():
    raw = (
        "Intro\n\n"
        "| Situação | Redução |\n"
        "|----------|--------|\n"
        "| Desemprego | 50% |\n"
        "| Doença | 40% |\n\n"
        "Conclusão com duas  palavras."
    )
    cleaned = clean_documental_markdown(raw)
    assert "| Situação | Redução |" in cleaned
    assert "| Desemprego | 50% |" in cleaned
    assert "Conclusão com duas palavras." in cleaned


def test_prepare_adds_doc_tags():
    md = "Um deck construído exige no mínimo 60 cartas."
    body, docs = prepare_documental_response(
        md,
        messages=[],
        vfs_files=[{"path": "/legal-kb/the-gathering-rules-cmpss5i6.txt"}],
        route="documental",
    )
    assert "[Doc:" in body
    assert docs
    assert "Gathering" in docs[0]
