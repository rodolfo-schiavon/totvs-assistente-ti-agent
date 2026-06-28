"""Camada semântica: mapeia entidades e rotas para tools do agente."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

RouteName = str

_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "config" / "semantic_schema.yaml"


@lru_cache(maxsize=1)
def load_schema() -> dict[str, Any]:
    with open(_SCHEMA_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def describe_entity(name: str) -> dict[str, Any] | None:
    entities = load_schema().get("entities") or {}
    return entities.get(name)


def tools_for_route(route: RouteName) -> list[str]:
    routes = load_schema().get("routes") or {}
    cfg = routes.get(route) or {}
    return list(cfg.get("tools") or [])


def all_tool_names() -> list[str]:
    routes = load_schema().get("routes") or {}
    names: set[str] = set()
    for cfg in routes.values():
        for t in cfg.get("tools") or []:
            names.add(t)
    return sorted(names)


def suggest_tools(question: str, route: RouteName | None = None) -> list[str]:
    if route:
        return tools_for_route(route)
    q = question.lower()
    suggested: list[str] = []
    entities = load_schema().get("entities") or {}
    for entity in entities.values():
        for example in entity.get("common_questions") or []:
            if any(w in q for w in example.lower().split() if len(w) > 4):
                suggested.extend(entity.get("tools") or [])
    return list(dict.fromkeys(suggested))[:8]


def format_for_prompt(route: RouteName) -> str:
    routes = load_schema().get("routes") or {}
    entities = load_schema().get("entities") or {}
    tools = tools_for_route(route)
    lines = [f"Rota ativa: **{route}**", f"Tools prioritárias: {', '.join(f'`{t}`' for t in tools)}"]
    if route in ("hybrid", "documental"):
        kb = entities.get("knowledge_documents") or {}
        lines.append(f"Base documental: {kb.get('description', '')}")
    if route in ("operational", "hybrid", "analytical", "report"):
        tk = entities.get("tickets") or {}
        lines.append(f"Dados operacionais: {tk.get('description', '')} (fonte: último import)")
    return "\n".join(lines)


def expand_hybrid_query(question: str) -> str:
    """Expande query para prefetch KB em perguntas híbridas."""
    q = question.lower()
    extras: list[str] = []
    if "sla" in q:
        extras.extend(["SLA", "contrato", "severidade", "tempo de resolução"])
    if "contrato" in q or "política" in q or "politica" in q:
        extras.extend(["política", "contrato", "regra"])
    if not extras:
        return question
    return f"{question} {' '.join(extras)}"


def catalog_summary() -> str:
    entities = load_schema().get("entities") or {}
    parts: list[str] = ["Catálogo de dados disponível:"]
    for name, ent in entities.items():
        tools = ent.get("tools") or []
        parts.append(f"- **{name}**: {ent.get('description', '')} (tools: {', '.join(tools[:5])})")
    parts.append("\nLimitação: métricas refletem o último batch importado (Spiceworks), não SQL em tempo real.")
    return "\n".join(parts)


def match_entity_keywords(question: str) -> list[str]:
    q = question.lower()
    hits: list[str] = []
    for name, ent in (load_schema().get("entities") or {}).items():
        for example in ent.get("common_questions") or []:
            tokens = [t for t in re.findall(r"\w+", example.lower()) if len(t) > 4]
            if sum(1 for t in tokens if t in q) >= 2:
                hits.append(name)
                break
    return hits
