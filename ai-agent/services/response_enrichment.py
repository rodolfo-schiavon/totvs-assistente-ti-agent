"""Gera follow-ups, sources e enriquecimentos do MixedResponse."""

from __future__ import annotations

from app.schemas import KpiSpec, MixedResponse, ResponseSource
from services.tool_observability import tools_to_source_type

DATA_LIMITATION = "Análise baseada nos documentos e na base de conhecimento disponíveis no momento."

_FOLLOW_UPS: dict[str, list[str]] = {
    "documental": [
        "Quais cláusulas merecem revisão jurídica?",
        "Resuma as obrigações das partes",
        "Identifique riscos contratuais principais",
    ],
    "hybrid": [
        "Compare com modelos da base de conhecimento",
        "Sugira ajustes em cláusulas sensíveis",
        "Elabore um resumo executivo",
    ],
    "analytical": [
        "Quais pontos exigem parecer do advogado responsável?",
        "Liste prazos e marcos relevantes",
        "Sugira minuta de alteração contratual",
    ],
    "report": [
        "Detalhe os riscos por severidade",
        "Gere checklist de conformidade",
        "Indique legislação aplicável a revisar",
    ],
    "operational": [
        "Quais documentos da base sustentam esta análise?",
        "Há precedentes internos sobre o tema?",
        "Sugira perguntas para o cliente",
    ],
}

_SOURCE_LABELS = {
    "knowledge": "Base de conhecimento",
    "system": "Dados do sistema",
    "hybrid": "Base de conhecimento + anexos",
}


def build_sources(
    route: str | None,
    tool_names: list[str],
    kb_prefetch: bool = False,
    documents: list[str] | None = None,
    has_attachments: bool = False,
) -> list[ResponseSource]:
    source_type = tools_to_source_type(tool_names, route)
    if kb_prefetch and source_type == "system":
        source_type = "hybrid"
    label = _SOURCE_LABELS.get(source_type, "Base de conhecimento")
    docs = documents or []
    if has_attachments:
        label = "Anexos da conversa"
    elif docs and source_type == "knowledge":
        label = "Base de conhecimento"
    return [
        ResponseSource(
            type=source_type,
            label=label,
            tools_used=tool_names[:10],
            documents=docs[:8],
        )
    ]


def build_follow_ups(route: str | None, message: str) -> list[str]:
    base = _FOLLOW_UPS.get(route or "documental", _FOLLOW_UPS["documental"])
    q = message.lower()
    if "contrato" in q or "cláusula" in q:
        return [
            "Quais cláusulas são mais sensíveis?",
            "Sugira redação alternativa para pontos críticos",
            "Compare com modelos da base de conhecimento",
        ]
    if "risco" in q:
        return [
            "Classifique os riscos por severidade",
            "Quais mitigações você recomenda?",
            "Há impactos trabalhistas ou tributários?",
        ]
    if "resumo" in q or "executivo" in q:
        return [
            "Detalhe obrigações das partes",
            "Liste prazos e penalidades",
            "Indique pontos para revisão humana",
        ]
    return base[:3]


def enrich_mixed_response(
    mixed: MixedResponse,
    route: str | None,
    tool_names: list[str],
    kb_prefetch: bool = False,
    documents: list[str] | None = None,
    has_attachments: bool = False,
) -> MixedResponse:
    mixed.route = route
    mixed.sources = build_sources(route, tool_names, kb_prefetch, documents, has_attachments)
    mixed.follow_ups = build_follow_ups(route, mixed.markdown)
    if route in ("documental", "hybrid", "analytical", "report", "operational"):
        mixed.data_limitations = DATA_LIMITATION
    return mixed


async def maybe_add_analytical_kpis(mixed: MixedResponse, api, route: str | None, period_preset: str | None = None) -> MixedResponse:
    if route not in ("analytical", "report") or mixed.kpis:
        return mixed
    return mixed
