"""Busca determinística no VFS para orientar o Deep Agent (não substitui tools)."""

from __future__ import annotations

import re
from typing import Iterable

from app.vfs_backend import KB_VFS_PATH, PROJECT_NAMESPACE

# Perguntas em PT → termos também em EN (documentos costumam estar em inglês)
_PT_EN_HINTS: dict[str, list[str]] = {
    "carta": ["card", "cards", "deck"],
    "cartas": ["card", "cards", "deck"],
    "jogar": ["play", "deck", "game"],
    "baralho": ["deck", "library"],
    "grimório": ["library", "deck"],
    "mínimo": ["minimum", "min"],
    "minimo": ["minimum", "min"],
    "quantas": ["how many", "minimum", "number"],
    "quantos": ["how many", "minimum", "number"],
    "regra": ["rule", "rules"],
    "regras": ["rule", "rules"],
    "sideboard": ["sideboard"],
    "construído": ["constructed"],
    "construido": ["constructed"],
    "terreno": ["terrain", "land", "terrains"],
    "terrenos": ["terrain", "land", "terrains"],
    "serve": ["purpose", "function"],
    "limitado": ["limited"],
}


def expand_search_terms(question: str) -> list[str]:
    """Gera termos de busca (PT + EN) a partir da pergunta."""
    q = question.lower()
    terms: list[str] = []

    for pt, en_list in _PT_EN_HINTS.items():
        if pt in q:
            terms.extend(en_list)

    # Tokens significativos da pergunta
    for token in re.findall(r"[a-záàâãéêíóôõúç0-9]{4,}", q, re.I):
        terms.append(token)

    # Termos genéricos para perguntas sobre quantidade / regras de jogo
    if any(w in q for w in ("quantas", "quantos", "precisa", "número", "numero", "mínimo", "minimo")):
        terms = ["minimum", "deck", "60", "library", "constructed", *terms]

    seen: set[str] = set()
    out: list[str] = []
    for t in terms:
        key = t.lower().strip()
        if key and key not in seen and len(key) >= 2:
            seen.add(key)
            out.append(t)
    return out[:16]


def _score_line(line: str, terms: list[str]) -> int:
    low = line.lower()
    score = 0
    if "minimum" in low and "deck" in low:
        score += 10
    if "60" in low and "card" in low:
        score += 10
    if "deck size" in low:
        score += 8
    for term in terms:
        if term.lower() in low:
            score += 2
    return score


def _grep_lines(lines: list[str], terms: list[str], max_hits: int = 8) -> list[tuple[int, str, str, int]]:
    hits: list[tuple[int, str, str, int]] = []
    for line_num, line in enumerate(lines, 1):
        low = line.lower()
        matched = next((t for t in terms if t.lower() in low), None)
        if not matched:
            continue
        score = _score_line(line, terms)
        hits.append((line_num, matched, line.strip()[:280], score))
    hits.sort(key=lambda x: (-x[3], x[0]))
    return hits[:max_hits]


async def build_vfs_search_hints(store, question: str, max_hits: int = 4) -> str:
    """Retorna bloco de hints com linhas encontradas no VFS (auxilia ls/grep/read_file)."""
    terms = expand_search_terms(question)
    if not terms:
        return ""

    namespace = (PROJECT_NAMESPACE,)
    try:
        items = await store.asearch(namespace, limit=50)
    except Exception:
        return ""

    blocks: list[str] = []
    for item in items:
        val = item.value or {}
        lines = [str(x) for x in (val.get("content") or [])]
        if not lines:
            continue
        hits = _grep_lines(lines, terms)
        if not hits:
            continue
        path = f"{KB_VFS_PATH.rstrip('/')}{item.key}"
        hit_lines = "\n".join(
            f"  - linha {num} (termo `{term}`, score={score}): {text}"
            for num, term, text, score in hits
        )
        blocks.append(f"**{path}**\n{hit_lines}")

    if not blocks:
        return ""

    term_list = ", ".join(f"`{t}`" for t in terms[:8])
    return (
        f"\n\n[DICA SISTEMA — busca automática no VFS para orientar grep/read_file]\n"
        f"Termos sugeridos: {term_list}\n"
        + "\n\n".join(blocks)
        + "\nUse read_file com offset/limit nas linhas indicadas para confirmar antes de responder.\n]"
    )
