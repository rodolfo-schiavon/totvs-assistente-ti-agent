"""Tests for KB → VFS sync helpers."""

from datetime import UTC, datetime

from services.kb_vfs_sync import _payload_has_content, build_markdown, file_data, slugify


def test_slugify_includes_id_suffix():
    slug = slugify("Política SLA", "abc12345-6789")
    assert slug.endswith("-abc12345.md")
    assert "pol" in slug.lower() or "politica" in slug.lower()


def test_slugify_preserves_extension():
    slug = slugify("planilha.xlsx", "doc12345")
    assert slug.endswith(".xlsx")
    assert "doc12345" in slug


def test_build_markdown_has_frontmatter():
    doc = {
        "title": "Manual",
        "id": "doc-1",
        "mimeType": "text/plain",
        "extractedPreview": "Resumo curto",
        "extractedText": "Corpo completo do documento.",
        "updatedAt": "2026-05-22T12:00:00Z",
    }
    md = build_markdown(doc)
    assert md.startswith("---")
    assert "título: Manual" in md
    assert "Corpo completo" in md


def test_file_data_splits_lines():
    now = datetime.now(UTC).isoformat()
    payload = file_data("linha1\nlinha2", now)
    assert payload["content"] == ["linha1", "linha2"]
    assert payload["modified_at"] == now


def test_payload_has_content_detects_empty():
    assert _payload_has_content({"content": ["a", "b"]}) is True
    assert _payload_has_content({"content": ["", "  "]}) is False
    assert _payload_has_content({"content": []}) is False
