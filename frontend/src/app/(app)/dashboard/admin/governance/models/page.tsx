"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { DataTable } from "@/components/governance/DataTable";
import { Card } from "@/components/ui/card";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";

function Page() {
  return (
    <GovernanceFetchPage
      title="Analytics de Modelos"
      section="models"
      endpoint="/api/governance/models"
      render={(raw) => {
        const data = raw as { items?: Array<Record<string, unknown>> };
        return (
          <Card className="p-4">
            <DataTable
              columns={[
                { key: "model", label: "Modelo" },
                { key: "provider", label: "Provedor" },
                { key: "turns", label: "Turnos" },
                { key: "totalTokens", label: "Tokens" },
                { key: "costUsd", label: "Custo" },
                { key: "avgLatencyMs", label: "Latência média" },
              ]}
              rows={(data.items || []).map((i) => ({
                model: String(i.model ?? "—"),
                provider: String(i.provider ?? "—"),
                turns: String(i.turns ?? 0),
                totalTokens: formatTokenCount(Number(i.totalTokens ?? 0)),
                costUsd: formatCostUsd(Number(i.costUsd ?? 0)),
                avgLatencyMs: `${Math.round(Number(i.avgLatencyMs ?? 0))} ms`,
              }))}
            />
          </Card>
        );
      }}
    />
  );
}

export default function GovernanceModelsPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
