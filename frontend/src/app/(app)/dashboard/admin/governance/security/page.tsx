"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { DataTable } from "@/components/governance/DataTable";
import { SeverityBadge } from "@/components/governance/SeverityBadge";
import { Card } from "@/components/ui/card";

function Page() {
  return (
    <GovernanceFetchPage
      title="Segurança"
      section="security"
      endpoint="/api/governance/security"
      render={(raw) => {
        const data = raw as { items?: Array<Record<string, unknown>> };
        return (
          <Card className="p-4">
            <DataTable
              columns={[
                { key: "createdAt", label: "Data" },
                { key: "severity", label: "Severidade" },
                { key: "pattern", label: "Padrão" },
                { key: "blocked", label: "Bloqueado" },
                { key: "snippet", label: "Trecho" },
              ]}
              rows={(data.items || []).map((i) => ({
                createdAt: i.createdAt ? new Date(String(i.createdAt)).toLocaleString("pt-BR") : "—",
                severity: <SeverityBadge value={String(i.severity)} />,
                pattern: String(i.pattern ?? "—"),
                blocked: i.blocked ? "Sim" : "Não",
                snippet: String(i.promptSnippet ?? "").slice(0, 80),
              }))}
            />
          </Card>
        );
      }}
    />
  );
}

export default function GovernanceSecurityPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
