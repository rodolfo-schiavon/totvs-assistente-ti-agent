"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { DataTable } from "@/components/governance/DataTable";
import { Card } from "@/components/ui/card";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";

function Page() {
  return (
    <GovernanceFetchPage
      title="Observabilidade LLM"
      section="observability"
      endpoint="/api/governance/observability/llm"
      render={(raw) => {
        const data = raw as { items?: Record<string, unknown>[] };
        return (
          <Card className="p-4">
            <DataTable
              columns={[
                { key: "createdAt", label: "Data" },
                { key: "model", label: "Modelo" },
                { key: "route", label: "Rota" },
                { key: "totalTokens", label: "Tokens" },
                { key: "cost", label: "Custo" },
                { key: "latencyMs", label: "Latência" },
                { key: "status", label: "Status" },
              ]}
                rows={(data.items || []).map((i) => ({
                  createdAt: i.createdAt ? new Date(String(i.createdAt)).toLocaleString("pt-BR") : "—",
                  model: `${String(i.provider ?? "")}/${String(i.model ?? "")}`,
                  route: String(i.route ?? "—"),
                  totalTokens: formatTokenCount(Number(i.totalTokens ?? 0)),
                  cost: formatCostUsd(Number(i.estimatedCostUsd ?? 0)),
                  latencyMs: String(i.latencyMs ?? "—"),
                  status: String(i.status ?? "—"),
                }))}
            />
          </Card>
        );
      }}
    />
  );
}

export default function GovernanceObservabilityPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
