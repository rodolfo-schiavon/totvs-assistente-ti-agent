"""Roteador de intenção — Assistente TI (operational / analytical / documental)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

RouteKind = Literal["operational", "analytical", "documental"]

_OPS = re.compile(
    r"\b(cluster|argo|deployment|pod|healthy|sa[uú]de|status|sync|outofsync|log|gateway|mlflow)\b",
    re.I,
)
_METRICS = re.compile(
    r"\b(prometheus|promql|lat[eê]ncia|p95|cpu|mem[oó]ria|m[eé]trica|restart|erro|trace|langfuse)\b",
    re.I,
)
_DOCS = re.compile(
    r"\b(como|documenta|runbook|readme|arquitetura|gitops|helm|spec|docs?)\b",
    re.I,
)


@dataclass
class RouteDecision:
    route: RouteKind
    confidence: float
    prefetch_kb: bool
    allowed_tool_names: list[str] = field(default_factory=list)
    reasoning: str = ""
    expanded_query: str | None = None


def route_query(
    question: str,
    prior_human: list[str] | None = None,
    knowledge_mode: bool = False,
) -> RouteDecision:
    del prior_human
    q = question.strip()
    q_norm = re.sub(r"[^\w\sáàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ-]", " ", q)
    ops_hit = bool(_OPS.search(q_norm))
    metrics_hit = bool(_METRICS.search(q_norm))
    if knowledge_mode:
        return RouteDecision(
            route="documental",
            confidence=0.85,
            prefetch_kb=True,
            reasoning="knowledge_mode",
        )
    if ops_hit and metrics_hit:
        return RouteDecision(
            route="operational",
            confidence=0.8,
            prefetch_kb=False,
            reasoning="mixed_ops_metrics_ops_first",
        )
    if metrics_hit:
        return RouteDecision(
            route="analytical",
            confidence=0.8,
            prefetch_kb=False,
            reasoning="metrics_analytics",
        )
    if ops_hit:
        return RouteDecision(
            route="operational",
            confidence=0.8,
            prefetch_kb=False,
            reasoning="operational_status",
        )
    if _DOCS.search(q_norm):
        return RouteDecision(
            route="documental",
            confidence=0.85,
            prefetch_kb=True,
            reasoning="platform_docs",
        )
    return RouteDecision(
        route="documental",
        confidence=0.55,
        prefetch_kb=True,
        reasoning="default_platform_docs",
    )
