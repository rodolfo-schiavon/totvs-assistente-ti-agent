"""Tests for VFS search hint helpers."""

from services.vfs_search import expand_search_terms


def test_expand_search_terms_portuguese_deck_question():
    terms = expand_search_terms("quantas cartas precisa ter para jogar?")
    assert "deck" in terms
    assert "minimum" in terms
    assert "60" in terms
    assert "cartas" in terms or "card" in terms


def test_expand_search_terms_includes_english_for_grimorio():
    terms = expand_search_terms("tamanho mínimo do grimório")
    assert "library" in terms
    assert "minimum" in terms
