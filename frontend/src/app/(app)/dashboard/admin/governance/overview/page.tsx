"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { KpiGrid } from "@/components/governance/KpiGrid";
import { TimeSeriesChart } from "@/components/governance/TimeSeriesChart";
import { Card } from "@/components/ui/card";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";

type Overview = {
  kpis: Record<string, number | null>;
  openAlerts: number;
  series: { daily: Array<{ date: string; turns: number; tokens: number; costUsd: number; errors: number }> };
};

function OverviewContent() {
  return (
    <GovernanceFetchPage
      title="Visão Geral"
      section="overview"
      endpoint="/api/governance/overview"
      render={(raw) => {
        const data = raw as Overview;
        const k = data.kpis || {};
        return (
          <div className="space-y-6">
            <KpiGrid
              items={[
                { label: "Turnos LLM", value: k.turns ?? 0 },
                { label: "Tokens", value: formatTokenCount(Number(k.totalTokens ?? 0)) },
                { label: "Custo estimado", value: formatCostUsd(Number(k.totalCostUsd ?? 0)) },
                { label: "Usuários ativos", value: k.activeUsers ?? 0 },
                { label: "Conversas", value: k.activeConversations ?? 0 },
                { label: "Prompts", value: k.prompts ?? 0 },
                { label: "Consultas RAG", value: k.ragQueries ?? 0 },
                { label: "Latência média", value: `${Math.round(Number(k.avgLatencyMs ?? 0))} ms` },
                { label: "Taxa de sucesso", value: `${Math.round(Number(k.successRate ?? 0) * 100)}%` },
                { label: "Satisfação (⭐)", value: k.avgFeedback != null ? Number(k.avgFeedback).toFixed(1) : "—" },
                { label: "Qualidade média", value: k.avgQualityScore != null ? Math.round(Number(k.avgQualityScore)) : "—" },
                { label: "Alertas abertos", value: data.openAlerts ?? 0 },
              ]}
            />
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Turnos por dia</h2>
              <TimeSeriesChart
                data={(data.series?.daily || []).map((d) => ({
                  date: new Date(d.date).toLocaleDateString("pt-BR"),
                  value: d.turns,
                }))}
              />
            </Card>
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Custo por dia (USD)</h2>
              <TimeSeriesChart
                data={(data.series?.daily || []).map((d) => ({
                  date: new Date(d.date).toLocaleDateString("pt-BR"),
                  value: Number(d.costUsd.toFixed(4)),
                }))}
                color="#60a5fa"
              />
            </Card>
          </div>
        );
      }}
    />
  );
}

export default function GovernanceOverviewPage() {
  return (
    <Suspense>
      <OverviewContent />
    </Suspense>
  );
}
