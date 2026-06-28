from __future__ import annotations

from langchain_core.messages import BaseMessage, HumanMessage

from app.schemas import ChartSpec, KpiSpec, MixedResponse
from services.markdown_table import parse_markdown_table, table_to_simple_series, table_to_volume_compare
from services.response_enrichment import enrich_mixed_response, maybe_add_analytical_kpis
from services.visual_intent import VisualIntent, analyze_visual_intent


def _looks_like_empty_answer(text: str) -> bool:
    import re

    t = text.lower()
    patterns = (
        r"\bn[aã]o (h[aá]|foram|existem|encontrei)",
        r"\bnenhum",
        r"\bzero chamados",
        r"\b0 chamados",
        r"\bsem (dados|chamados|registros|informa)",
        r"\bn[aã]o h[aá] dados",
    )
    return any(re.search(p, t) for p in patterns)


def _prior_human_messages(messages: list[BaseMessage] | None, limit: int = 4) -> list[str]:
    if not messages:
        return []
    out: list[str] = []
    for m in reversed(messages):
        if isinstance(m, HumanMessage) and m.content:
            text = m.content if isinstance(m.content, str) else str(m.content)
            out.append(text)
            if len(out) >= limit:
                break
    return out


def _volume_params(intent: VisualIntent) -> dict[str, str]:
    params: dict[str, str] = {}
    if intent.period_preset:
        params["periodPreset"] = intent.period_preset
    return params


def _normalize_series(items: list[dict]) -> list[dict]:
    """Garante {name, value} para o frontend renderizar todas as barras."""
    out: list[dict] = []
    for raw in items:
        name = raw.get("name") or raw.get("label") or raw.get("category")
        if name is None:
            continue
        value = raw.get("value")
        if value is None:
            value = raw.get("count") or raw.get("total") or 0
        try:
            num = int(value)
        except (TypeError, ValueError):
            continue
        if num <= 0:
            continue
        out.append({"name": str(name).strip(), "value": num})
    return out


async def _build_volume_compare(api, intent: VisualIntent, opened_only: bool = False) -> ChartSpec | None:
    volume = await api.analytics("/volume", _volume_params(intent))
    series = volume.get("volumeByPeriod") or []
    granularity = volume.get("granularity") or "week"
    if not series:
        return None

    data = [
        {
            "period": p.get("period") or p.get("label", ""),
            "label": p.get("label") or p.get("period", ""),
            "opened": int(p.get("opened") or 0),
            "closed": int(p.get("closed") or 0),
        }
        for p in series[-24:]
    ]
    if not data or sum(d["opened"] + d["closed"] for d in data) == 0:
        return None

    if opened_only:
        simple = [{"name": d["label"], "value": d["opened"]} for d in data if d["opened"] > 0]
        if not simple:
            return None
        return ChartSpec(
            type="bar",
            title="Chamados abertos por período",
            subtitle="Quantidade de aberturas no intervalo solicitado",
            data=simple,
            legend_name="Aberturas",
        )

    period_label = {"day": "dia", "week": "semana", "month": "mês"}.get(granularity, "período")
    return ChartSpec(
        type="volume_compare",
        title="Comparativo: abertos vs encerrados",
        subtitle=f"Aberturas e encerramentos por {period_label}",
        data=data,
        granularity=granularity,
        variant="bar" if intent.prefer_bar else "area",
    )


async def _build_status_chart(api, intent: VisualIntent) -> ChartSpec | None:
    data = await api.analytics("/by-status", _volume_params(intent))
    items = _normalize_series(data.get("items", []))
    if not items:
        return None
    return ChartSpec(
        type="bar",
        title="Chamados por status",
        subtitle="Distribuição por status no período",
        data=items,
        legend_name="Chamados",
        layout="vertical",
    )


async def _build_category_chart(api, intent: VisualIntent) -> ChartSpec | None:
    data = await api.analytics("/by-category", _volume_params(intent))
    items = _normalize_series(data.get("items", []))[:10]
    if not items:
        return None
    return ChartSpec(
        type="bar",
        title="Chamados por categoria",
        subtitle="Top categorias no período — valores e % no gráfico",
        data=items,
        legend_name="Chamados",
        layout="vertical",
    )


async def _build_priority_chart(api, intent: VisualIntent) -> ChartSpec | None:
    data = await api.analytics("/by-priority", _volume_params(intent))
    items = data.get("items", [])
    if not items:
        itil = await api.analytics("/itil", _volume_params(intent))
        sev = itil.get("slaBySeverity") or []
        items = [{"name": s.get("label", s.get("severity", "?")), "value": s.get("total", 0)} for s in sev if s.get("total")]
    if not items:
        return None
    return ChartSpec(
        type="donut",
        title="Chamados por prioridade/severidade",
        subtitle="Participação por severidade",
        data=items,
    )


async def _build_itil_chart(api, intent: VisualIntent) -> ChartSpec | None:
    data = await api.analytics("/itil", _volume_params(intent))
    items = data.get("items", [])
    if not items:
        return None
    return ChartSpec(
        type="donut",
        title="Tipos ITIL",
        subtitle="Incidentes, requisições e demais tipos",
        data=items,
    )


async def _build_sla_chart(api, intent: VisualIntent) -> tuple[list[KpiSpec], ChartSpec | None]:
    summary = await api.analytics("/summary", _volume_params(intent))
    raw = summary.get("kpis", {})
    kpis = [
        KpiSpec(label="SLA OK", value=raw.get("contractSlaMet", 0)),
        KpiSpec(label="Violados", value=raw.get("contractSlaViolated", 0)),
        KpiSpec(label="Compliance", value=f"{raw.get('contractSlaComplianceRate', 0):.1f}%"),
    ]
    itil = await api.analytics("/itil", _volume_params(intent))
    sev = itil.get("slaBySeverity") or []
    chart = None
    if sev:
        data = [{"name": s.get("label", s.get("severity", "?")), "value": s.get("total", 0)} for s in sev if s.get("total")]
        if data:
            chart = ChartSpec(
                type="bar",
                title="Volume por severidade (SLA)",
                subtitle="Chamados por severidade contratual",
                data=data,
                legend_name="Chamados",
            )
    return kpis, chart


async def _build_technician_chart(api, intent: VisualIntent) -> ChartSpec | None:
    data = await api.analytics("/agent-workload", _volume_params(intent))
    items = _normalize_series(data.get("items", []))[:10]
    if not items:
        return None
    return ChartSpec(
        type="bar",
        title="Carga por técnico",
        subtitle="Volume de chamados por analista",
        data=items,
        legend_name="Chamados",
        layout="horizontal",
    )


async def _build_requester_chart(api, intent: VisualIntent) -> ChartSpec | None:
    params = {**_volume_params(intent), "limit": "10"}
    data = await api.analytics("/by-requester", params)
    items = data.get("items", [])
    if not items:
        data = await api.analytics("/by-client", params)
        items = data.get("items", [])
    if not items:
        return None
    series = [{"name": i.get("name", "?"), "value": i.get("value", i.get("count", 0))} for i in items]
    return ChartSpec(
        type="bar",
        title="Top solicitantes",
        subtitle="Maiores volumes por solicitante/cliente",
        data=series,
        legend_name="Chamados",
        layout="horizontal",
    )


async def _build_executive(api, intent: VisualIntent) -> tuple[list[KpiSpec], list[ChartSpec]]:
    summary = await api.analytics("/summary", _volume_params(intent))
    raw = summary.get("kpis", {})
    kpis = [
        KpiSpec(label="Total", value=raw.get("totalTickets", 0)),
        KpiSpec(label="Abertos", value=raw.get("openTickets", 0)),
        KpiSpec(label="Fechados", value=raw.get("closedTickets", 0)),
        KpiSpec(label="Compliance SLA", value=f"{raw.get('contractSlaComplianceRate', 0):.1f}%"),
    ]
    charts: list[ChartSpec] = []
    if raw.get("totalTickets", 0) > 0:
        by_status = await api.analytics("/by-status", _volume_params(intent))
        items = by_status.get("items", [])
        if items:
            charts.append(
                ChartSpec(
                    type="bar",
                    title="Chamados por status",
                    subtitle="Panorama operacional",
                    data=items,
                    legend_name="Chamados",
                )
            )
    return kpis, charts


BUILDERS = {
    "volume_compare": lambda api, intent: _build_volume_compare(api, intent, opened_only=False),
    "volume_opened": lambda api, intent: _build_volume_compare(api, intent, opened_only=True),
    "status": _build_status_chart,
    "category": _build_category_chart,
    "priority": _build_priority_chart,
    "itil": _build_itil_chart,
    "technician": _build_technician_chart,
    "requester": _build_requester_chart,
}


def _chart_from_markdown(markdown: str, intent: VisualIntent) -> list[ChartSpec]:
    rows = parse_markdown_table(markdown)
    if not rows:
        return []

    if any(k in intent.kinds for k in ("volume_compare", "volume_opened")) or intent.explicit:
        vol = table_to_volume_compare(rows)
        if vol and any(d["opened"] or d["closed"] for d in vol):
            if any(d["closed"] for d in vol):
                return [
                    ChartSpec(
                        type="volume_compare",
                        title="Comparativo: abertos vs encerrados",
                        subtitle="Dados extraídos da análise textual",
                        data=vol,
                        granularity="week",
                        variant="bar",
                    )
                ]
            return [
                ChartSpec(
                    type="bar",
                    title="Chamados abertos por período",
                    subtitle="Dados extraídos da análise textual",
                    data=[{"name": d["label"], "value": d["opened"]} for d in vol],
                    legend_name="Aberturas",
                )
            ]

    simple = table_to_simple_series(rows)
    if simple:
        return [
            ChartSpec(
                type="bar",
                title="Distribuição",
                subtitle="Dados extraídos da análise textual",
                data=simple,
                legend_name="Quantidade",
            )
        ]
    return []


async def _finalize_mixed(
    mixed: MixedResponse,
    message: str,
    api,
    history_messages: list[BaseMessage] | None,
    route: str | None,
    tool_names: list[str] | None,
    kb_prefetch: bool,
    documents: list[str] | None = None,
    has_attachments: bool = False,
) -> MixedResponse:
    intent = analyze_visual_intent(message, _prior_human_messages(history_messages))
    mixed = await maybe_add_analytical_kpis(mixed, api, route, intent.period_preset)
    if route is not None:
        mixed = enrich_mixed_response(
            mixed, route, tool_names or [], kb_prefetch, documents, has_attachments
        )
    return mixed


async def build_mixed_response(
    message: str,
    markdown: str,
    api,
    history_messages: list[BaseMessage] | None = None,
    route: str | None = None,
    tool_names: list[str] | None = None,
    kb_prefetch: bool = False,
    documents: list[str] | None = None,
    has_attachments: bool = False,
) -> MixedResponse:
    if _looks_like_empty_answer(markdown):
        return await _finalize_mixed(
            MixedResponse(markdown=markdown, charts=[], kpis=[]),
            message, api, history_messages, route, tool_names, kb_prefetch, documents, has_attachments,
        )

    prior = _prior_human_messages(history_messages)
    intent = analyze_visual_intent(message, prior)

    # Implícito: palavras-chave sem pedido explícito de gráfico
    implicit = bool(intent.kinds) and not intent.explicit
    if not intent.explicit and not implicit:
        return await _finalize_mixed(
            MixedResponse(markdown=markdown, charts=[], kpis=[]),
            message, api, history_messages, route, tool_names, kb_prefetch, documents, has_attachments,
        )

    charts: list[ChartSpec] = []
    kpis: list[KpiSpec] = []

    try:
        if "executive" in intent.kinds:
            exec_kpis, exec_charts = await _build_executive(api, intent)
            kpis.extend(exec_kpis)
            charts.extend(exec_charts)

        if "sla" in intent.kinds:
            sla_kpis, sla_chart = await _build_sla_chart(api, intent)
            if not kpis:
                kpis.extend(sla_kpis)
            if sla_chart:
                charts.append(sla_chart)

        for kind in intent.kinds:
            if kind in ("executive", "sla"):
                continue
            builder = BUILDERS.get(kind)
            if not builder:
                continue
            chart = await builder(api, intent)
            if chart and not _duplicate_chart(charts, chart):
                charts.append(chart)

        if intent.explicit and not charts:
            fallback = await _build_volume_compare(api, intent, opened_only=False)
            if fallback:
                charts.append(fallback)

        if intent.explicit and not charts:
            charts.extend(_chart_from_markdown(markdown, intent))

    except Exception:
        if intent.explicit:
            charts.extend(_chart_from_markdown(markdown, intent))

    mixed = MixedResponse(markdown=markdown, charts=charts, kpis=kpis)
    return await _finalize_mixed(
        mixed, message, api, history_messages, route, tool_names, kb_prefetch, documents, has_attachments
    )


def _duplicate_chart(existing: list[ChartSpec], chart: ChartSpec) -> bool:
    return any(c.type == chart.type and c.title == chart.title for c in existing)
