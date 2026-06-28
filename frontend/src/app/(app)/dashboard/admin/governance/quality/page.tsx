"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { KpiGrid } from "@/components/governance/KpiGrid";
import { DataTable } from "@/components/governance/DataTable";
import { Card } from "@/components/ui/card";

function Page() {
  return (
    <GovernanceFetchPage
      title="Qualidade das Respostas"
      section="quality"
      endpoint="/api/governance/quality"
      render={(raw) => {
        const data = raw as { summary?: { score?: number; clarity?: number; context?: number }; items?: Record<string, unknown>[] };
        return (
          <div className="space-y-4">
            <KpiGrid
              items={[
                { label: "Score médio", value: Math.round(data.summary?.score ?? 0) },
                { label: "Clareza", value: Math.round(data.summary?.clarity ?? 0) },
                { label: "Contexto", value: Math.round(data.summary?.context ?? 0) },
              ]}
            />
            <Card className="p-4">
              <DataTable
                columns={[
                  { key: "createdAt", label: "Data" },
                  { key: "score", label: "Score" },
                  { key: "clarity", label: "Clareza" },
                  { key: "context", label: "Contexto" },
                  { key: "ragUsage", label: "RAG" },
                ]}
                rows={(data.items || []).map((i) => ({
                  ...i,
                  createdAt: i.createdAt ? new Date(String(i.createdAt)).toLocaleString("pt-BR") : "—",
                }))}
              />
            </Card>
          </div>
        );
      }}
    />
  );
}

export default function GovernanceQualityPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
