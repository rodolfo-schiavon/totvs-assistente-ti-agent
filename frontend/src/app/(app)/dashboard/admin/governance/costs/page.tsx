"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { KpiGrid } from "@/components/governance/KpiGrid";
import { DataTable } from "@/components/governance/DataTable";
import { Card } from "@/components/ui/card";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";

function Page() {
  return (
    <GovernanceFetchPage
      title="Custos"
      section="costs"
      endpoint="/api/governance/costs"
      render={(raw) => {
        const data = raw as {
          report?: {
            summary?: { totalTokens?: number; estimatedCostUsd?: number; activeUsers?: number };
            byUser?: Array<Record<string, unknown>>;
          };
        };
        const s = data.report?.summary;
        return (
          <div className="space-y-4">
            <KpiGrid
              items={[
                { label: "Tokens", value: formatTokenCount(s?.totalTokens ?? 0) },
                { label: "Custo total", value: formatCostUsd(s?.estimatedCostUsd ?? 0) },
                { label: "Usuários ativos", value: s?.activeUsers ?? 0 },
              ]}
            />
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Por usuário</h2>
              <DataTable
                columns={[
                  { key: "username", label: "Usuário" },
                  { key: "role", label: "Perfil" },
                  { key: "totalTokens", label: "Tokens" },
                  { key: "estimatedCostUsd", label: "Custo USD" },
                ]}
                rows={(data.report?.byUser || []).map((u) => ({
                  username: String(u.username ?? "—"),
                  role: String(u.role ?? "—"),
                  totalTokens: formatTokenCount(Number(u.totalTokens ?? 0)),
                  estimatedCostUsd: formatCostUsd(Number(u.estimatedCostUsd ?? 0)),
                }))}
              />
            </Card>
          </div>
        );
      }}
    />
  );
}

export default function GovernanceCostsPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
