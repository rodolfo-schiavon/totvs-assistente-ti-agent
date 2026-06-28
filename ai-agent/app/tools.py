import json
from typing import Optional

from langchain_core.tools import tool

from services.helpdesk_api import HelpdeskApi
from services.semantic_layer import catalog_summary

_api = HelpdeskApi()

_FILTER_KEYS = (
    "client", "requester", "organization", "technician", "category",
    "subcategory", "priority", "status", "slaStatus", "ticketNumber",
)


def _params(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    period_preset: Optional[str] = None,
    limit: int = 50,
    **filters: Optional[str],
) -> dict[str, str]:
    p: dict[str, str] = {"limit": str(limit)}
    if date_from:
        p["dateFrom"] = date_from
    if date_to:
        p["dateTo"] = date_to
    if period_preset:
        p["periodPreset"] = period_preset
    key_map = {
        "client": "client",
        "requester": "requester",
        "organization": "organization",
        "technician": "technician",
        "category": "category",
        "subcategory": "subcategory",
        "priority": "priority",
        "status": "status",
        "sla_status": "slaStatus",
        "ticket_number": "ticketNumber",
    }
    for arg, api_key in key_map.items():
        val = filters.get(arg)
        if val:
            p[api_key] = val
    return p


@tool
async def describe_data_catalog() -> str:
    """Retorna o catálogo semântico de entidades, métricas e tools disponíveis. Use quando precisar entender quais dados existem."""
    return catalog_summary()


@tool
async def search_tickets(
    date_from: str | None = None,
    date_to: str | None = None,
    period_preset: str | None = None,
    client: str | None = None,
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    technician: str | None = None,
    limit: int = 25,
) -> str:
    """Lista chamados filtrados por período, cliente, status, categoria, prioridade ou técnico. Máx 100 registros."""
    data = await _api.analytics("/tickets/search", _params(date_from, date_to, period_preset, limit, client=client, status=status, category=category, priority=priority, technician=technician))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_ticket_by_number(ticket_number: str) -> str:
    """Retorna detalhes de um chamado pelo número."""
    data = await _api.analytics("/tickets/by-number", {"ticketNumber": ticket_number})
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_sla_breaches(
    date_from: str | None = None,
    date_to: str | None = None,
    period_preset: str | None = None,
    client: str | None = None,
    limit: int = 25,
) -> str:
    """Chamados que violaram SLA contratual ou SLA importado."""
    data = await _api.analytics("/sla/breaches", _params(date_from, date_to, period_preset, limit, client=client))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_customer_operational_summary(
    date_from: str | None = None,
    date_to: str | None = None,
    period_preset: str | None = None,
    client: str | None = None,
    limit: int = 15,
) -> str:
    """Resumo operacional por cliente: volume, abertos, violações SLA, MTTR médio."""
    data = await _api.analytics("/customers/summary", _params(date_from, date_to, period_preset, limit, client=client))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_ticket_metrics(
    date_from: str | None = None,
    date_to: str | None = None,
    period_preset: str | None = None,
) -> str:
    """Métricas compostas: KPIs, volume e SLA em uma consulta."""
    params = _params(date_from, date_to, period_preset)
    summary = await _api.analytics("/summary", params)
    volume = await _api.analytics("/volume", params)
    breaches = await _api.analytics("/sla/breaches", {**params, "limit": "5"})
    return json.dumps({"summary": summary, "volume": volume, "slaBreachesSample": breaches.get("items", [])[:5]}, ensure_ascii=False)


@tool
async def get_tickets_summary(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None, client: str | None = None) -> str:
    """KPIs e resumo geral dos chamados. Use period_preset (today, yesterday, 7d, 1m, 3m, 6m, all) ou date_from/date_to (YYYY-MM-DD)."""
    data = await _api.analytics("/summary", _params(date_from, date_to, period_preset, client=client))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_tickets_by_status(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None, client: str | None = None) -> str:
    """Distribuição de chamados por status."""
    data = await _api.analytics("/by-status", _params(date_from, date_to, period_preset, client=client))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_tickets_by_category(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None, category: str | None = None) -> str:
    """Distribuição de chamados por categoria."""
    data = await _api.analytics("/by-category", _params(date_from, date_to, period_preset, category=category))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_sla_risk_tickets(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None, client: str | None = None) -> str:
    """Tickets abertos com SLA em risco."""
    data = await _api.analytics("/sla-risk", _params(date_from, date_to, period_preset, client=client))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_ticket_volume_by_period(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None) -> str:
    """Volume de chamados abertos e fechados por período."""
    data = await _api.analytics("/volume", _params(date_from, date_to, period_preset))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_predictive_analysis_data(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None) -> str:
    """Análise preditiva: tendências, clientes anormais e recorrência."""
    data = await _api.analytics("/predictive", _params(date_from, date_to, period_preset))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_agent_workload(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None, technician: str | None = None) -> str:
    """Carga de trabalho por técnico."""
    data = await _api.analytics("/agent-workload", _params(date_from, date_to, period_preset, technician=technician))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_itil_metrics(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None) -> str:
    """Métricas ITIL e SLA por severidade."""
    data = await _api.analytics("/itil", _params(date_from, date_to, period_preset))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_tickets_by_priority(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None) -> str:
    """Distribuição de chamados por prioridade/severidade (A, B, C, D)."""
    params = _params(date_from, date_to, period_preset)
    summary = await _api.analytics("/summary", params)
    itil = await _api.analytics("/itil", params)
    kpis = summary.get("kpis", {})
    return json.dumps({
        "highPriorityTickets": kpis.get("highPriorityTickets"),
        "criticalTickets": kpis.get("criticalTickets"),
        "slaBySeverity": itil.get("slaBySeverity", []),
    }, ensure_ascii=False)


@tool
async def get_top_requesters(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None, limit: int = 15) -> str:
    """Ranking de solicitantes/usuários com mais chamados (recorrentes)."""
    data = await _api.analytics("/by-client", _params(date_from, date_to, period_preset, limit))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_resolution_times(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None) -> str:
    """MTTR, MTTA e tempos médios de resposta e resolução em minutos, por técnico."""
    data = await _api.analytics("/resolution-time", _params(date_from, date_to, period_preset))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_labor_hours(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None) -> str:
    """Horas de labor/apontamento: total, tickets com apontamento, MTTR e MTTA."""
    data = await _api.analytics("/summary", _params(date_from, date_to, period_preset))
    kpis = data.get("kpis", {})
    return json.dumps({
        "totalHoursUsed": kpis.get("totalHoursUsed"),
        "totalLaborMinutes": kpis.get("totalLaborMinutes"),
        "ticketsWithLabor": kpis.get("ticketsWithLabor"),
        "mttr": kpis.get("mttr"),
        "mtta": kpis.get("mtta"),
        "avgResponseMinutes": kpis.get("avgResponseMinutes"),
        "avgResolutionMinutes": kpis.get("avgResolutionMinutes"),
        "hasMttaData": kpis.get("hasMttaData"),
    }, ensure_ascii=False)


@tool
async def get_reopened_tickets(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None) -> str:
    """Chamados reabertos no período."""
    data = await _api.analytics("/reopened", _params(date_from, date_to, period_preset))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_top_clients(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None, limit: int = 15) -> str:
    """Organizações/clientes com maior volume de chamados."""
    data = await _api.analytics("/top-clients", _params(date_from, date_to, period_preset, limit))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_itil_types(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None) -> str:
    """Distribuição por tipo ITIL (incidente, requisição, problem) e SLA por severidade."""
    data = await _api.analytics("/itil", _params(date_from, date_to, period_preset))
    return json.dumps(data, ensure_ascii=False)


@tool
async def get_itil_types(date_from: str | None = None, date_to: str | None = None, period_preset: str | None = None) -> str:
    """Distribuição por tipo ITIL (incidente, requisição, problem) e SLA por severidade."""
    data = await _api.analytics("/itil", _params(date_from, date_to, period_preset))
    return json.dumps(data, ensure_ascii=False)


ANALYTICS_TOOLS = [
    describe_data_catalog,
    search_tickets,
    get_ticket_by_number,
    get_sla_breaches,
    get_customer_operational_summary,
    get_ticket_metrics,
    get_tickets_summary,
    get_tickets_by_status,
    get_tickets_by_category,
    get_tickets_by_priority,
    get_top_requesters,
    get_sla_risk_tickets,
    get_ticket_volume_by_period,
    get_predictive_analysis_data,
    get_agent_workload,
    get_itil_metrics,
    get_resolution_times,
    get_labor_hours,
    get_reopened_tickets,
    get_top_clients,
    get_itil_types,
]

_TOOL_BY_NAME = {t.name: t for t in ANALYTICS_TOOLS}

# Backward compat
ALL_AGENT_TOOLS = ANALYTICS_TOOLS
AGENT_TOOLS = ANALYTICS_TOOLS


def analytics_tools_for_names(names: list[str] | None) -> list:
    if not names:
        return []
    selected = [_TOOL_BY_NAME[n] for n in names if n in _TOOL_BY_NAME]
    return selected if selected else []


def tools_for_names(names: list[str] | None) -> list:
    return analytics_tools_for_names(names)
