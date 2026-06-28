"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { KpiGrid } from "@/components/governance/KpiGrid";
import { Card } from "@/components/ui/card";

function Page() {
  return (
    <GovernanceFetchPage
      title="Analytics de Uso"
      section="usage"
      endpoint="/api/governance/usage"
      render={(raw) => {
        const data = raw as {
          byCategory?: Array<{ promptCategory: string; _count: { _all: number } }>;
          byRole?: Record<string, number>;
          productivity?: { hoursSaved?: number; roiBrl?: number; disclaimer?: string };
        };
        return (
          <div className="space-y-4">
            <KpiGrid
              items={[
                { label: "Horas economizadas (est.)", value: data.productivity?.hoursSaved ?? 0 },
                { label: "ROI estimado (BRL)", value: data.productivity?.roiBrl ?? 0 },
              ]}
            />
            <p className="text-xs text-[var(--color-muted)]">{data.productivity?.disclaimer}</p>
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">Por categoria de prompt</h2>
              <ul className="space-y-1 text-sm">
                {(data.byCategory || []).map((c) => (
                  <li key={c.promptCategory} className="flex justify-between">
                    <span>{c.promptCategory}</span>
                    <span>{c._count._all}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">Por perfil</h2>
              <ul className="space-y-1 text-sm">
                {Object.entries(data.byRole || {}).map(([role, count]) => (
                  <li key={role} className="flex justify-between">
                    <span>{role}</span>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        );
      }}
    />
  );
}

export default function GovernanceUsagePage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
