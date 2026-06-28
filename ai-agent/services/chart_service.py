from app.schemas import ChartSpec, KpiSpec, MixedResponse


def build_mixed_from_tool_data(summary: dict, by_status: dict) -> MixedResponse:
    kpis_raw = summary.get("kpis", {})
    kpis = [
        KpiSpec(label="Total de chamados", value=kpis_raw.get("totalTickets", 0)),
        KpiSpec(label="Abertos", value=kpis_raw.get("openTickets", 0)),
        KpiSpec(label="Fechados", value=kpis_raw.get("closedTickets", 0)),
        KpiSpec(label="SLA cumprido %", value=round(kpis_raw.get("slaComplianceRate", 0), 1)),
    ]
    charts = [
        ChartSpec(
            type="bar",
            title="Chamados por status",
            data=by_status.get("items", []),
        )
    ]
    md = (
        f"**Resumo operacional** — {kpis_raw.get('totalTickets', 0)} chamados no período filtrado. "
        f"{kpis_raw.get('openTickets', 0)} abertos, {kpis_raw.get('closedTickets', 0)} encerrados. "
        f"Taxa de cumprimento de SLA: {kpis_raw.get('slaComplianceRate', 0):.1f}%."
    )
    return MixedResponse(markdown=md, charts=charts, kpis=kpis)
