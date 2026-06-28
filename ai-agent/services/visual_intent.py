"""Detecta intenção visual explícita/implícita e infere tipo de gráfico."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

ChartKind = Literal[
    "volume_compare",
    "volume_opened",
    "status",
    "category",
    "priority",
    "itil",
    "sla",
    "technician",
    "requester",
    "executive",
]

EXPLICIT_VISUAL_PATTERNS = (
    r"\bgr[aá]fic",
    r"\bchart\b",
    r"\bvisualiz",
    r"\bvisual\b",
    r"\brelat[oó]rio",
    r"\bdashboard\b",
    r"\bpainel\b",
    r"\bmostre\b",
    r"\bapresente\b",
    r"\bexiba\b",
    r"\bplot\b",
    r"\bdiagrama",
    r"\bfigura\b",
)

REFERENTIAL_PATTERNS = (
    r"\bisso\b",
    r"\biss[oó]\b",
    r"\bmesmo\b",
    r"\bacima\b",
    r"\banterior\b",
    r"\bcomparativo\b",
    r"\bn?esse\b",
    r"\bn?essa\b",
    r"\bn?estes\b",
    r"\bn?estas\b",
)

VOLUME_COMPARE_HINTS = (
    "comparativo",
    "versus",
    " vs ",
    "abertos e fechados",
    "abertos x fechados",
    "abertura e encerr",
    "aberturas e encerr",
    "abertos versus",
)

VOLUME_OPENED_HINTS = (
    "chamados abertos nos",
    "chamados abertos no",
    "chamados abertos por",
    "chamados abertos nos últimos",
    "chamados abertos nos ultimos",
    "aberturas nos",
    "aberturas no",
    "aberturas por",
    "volume de abert",
    "quantidade de abert",
    "tickets abertos nos",
)

STATUS_HINTS = ("por status", "distribuição de status", "distribuição por status", "status dos chamados")
CATEGORY_HINTS = ("por categoria", "categorias", "top categorias", "distribuição de categorias")
PRIORITY_HINTS = ("prioridade", "severidade", "severidade a", "severidade b")
ITIL_HINTS = ("itil", "incidente", "requisição", "requisicao", "problem")
SLA_HINTS = ("sla", "compliance", "cumprimento")
TECH_HINTS = ("técnico", "tecnico", "analista", "workload", "carga")
REQUESTER_HINTS = ("solicitante", "requester", "cliente", "organização", "organizacao")
EXECUTIVE_HINTS = ("resumo executivo", "visão geral", "panorama", "kpis principais", "overview")


@dataclass
class VisualIntent:
    explicit: bool
    kinds: list[ChartKind]
    period_preset: str | None
    prefer_bar: bool


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def wants_explicit_visual(text: str) -> bool:
    m = _norm(text)
    if any(re.search(p, m) for p in EXPLICIT_VISUAL_PATTERNS):
        if any(k in m for k in ("gráfico", "grafico", "chart", "visual", "relatório", "relatorio", "dashboard", "painel")):
            return True
        if any(v in m for v in ("mostre", "apresente", "exiba")) and any(
            k in m for k in ("gráfico", "grafico", "visual", "relatório", "relatorio", "chart")
        ):
            return True
    return bool(re.search(r"\bgr[aá]fic|\bchart\b|\bvisualiz|\brelat[oó]rio visual", m))


def is_referential(text: str) -> bool:
    return any(re.search(p, _norm(text)) for p in REFERENTIAL_PATTERNS)


def effective_query(message: str, prior_human: list[str]) -> str:
    """Combina mensagem atual com histórico quando o usuário referencia contexto anterior."""
    parts = [message.strip()]
    if is_referential(message) or wants_explicit_visual(message):
        for msg in prior_human:
            if msg.strip() and msg.strip() not in parts:
                parts.append(msg.strip())
    return " ".join(parts)


def infer_period_preset(text: str) -> str | None:
    m = _norm(text)
    if re.search(r"3\s*mes(es)?|03\s*mes(es)?|trimestre|últimos 3|ultimos 3", m):
        return "3m"
    if re.search(r"6\s*mes(es)?|semestre|últimos 6|ultimos 6", m):
        return "6m"
    if re.search(r"30\s*dias|últimos 30|ultimos 30", m):
        return "1m"
    if re.search(r"7\s*dias|última semana|ultima semana|últimos 7|ultimos 7", m):
        return "7d"
    if re.search(r"m[eê]s passado|ultimo m[eê]s|último m[eê]s|1\s*m[eê]s", m):
        return "1m"
    if re.search(r"\bhoje\b", m):
        return "today"
    if re.search(r"\bontem\b", m):
        return "yesterday"
    return None


def infer_chart_kinds(text: str) -> list[ChartKind]:
    m = _norm(text)
    kinds: list[ChartKind] = []

    def add(kind: ChartKind) -> None:
        if kind not in kinds:
            kinds.append(kind)

    if any(h in m for h in VOLUME_COMPARE_HINTS):
        add("volume_compare")
    if any(h in m for h in VOLUME_OPENED_HINTS):
        add("volume_opened")
    if any(h in m for h in STATUS_HINTS) or ("distribui" in m and "status" in m):
        add("status")
    if any(h in m for h in CATEGORY_HINTS):
        add("category")
    if any(h in m for h in PRIORITY_HINTS):
        add("priority")
    if any(h in m for h in ITIL_HINTS):
        add("itil")
    if any(h in m for h in SLA_HINTS):
        add("sla")
    if any(h in m for h in TECH_HINTS):
        add("technician")
    if any(h in m for h in REQUESTER_HINTS):
        add("requester")
    if any(h in m for h in EXECUTIVE_HINTS):
        add("executive")

    if not kinds and re.search(r"tend[eê]ncia|evolu|hist[oó]rico|volume|per[ií]odo|mes(es)?|semana", m):
        add("volume_compare")

    return kinds


def analyze_visual_intent(message: str, prior_human: list[str] | None = None) -> VisualIntent:
    prior = prior_human or []
    query = effective_query(message, prior)
    explicit = wants_explicit_visual(message) or wants_explicit_visual(query)
    kinds = infer_chart_kinds(query)
    period = infer_period_preset(query)
    prefer_bar = any(k in _norm(query) for k in ("barra", "barras", "comparativo", "relatório", "relatorio", "gráfico", "grafico"))

    if explicit and not kinds:
        kinds = ["volume_compare"]

    if explicit and "volume_opened" in kinds and "volume_compare" not in kinds:
        if any(h in _norm(query) for h in VOLUME_COMPARE_HINTS):
            kinds = ["volume_compare"] + [k for k in kinds if k != "volume_opened"]

    return VisualIntent(
        explicit=explicit,
        kinds=kinds,
        period_preset=period,
        prefer_bar=prefer_bar or explicit,
    )
