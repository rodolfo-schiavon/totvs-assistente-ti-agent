"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { KpiGrid } from "@/components/governance/KpiGrid";
import { DataTable } from "@/components/governance/DataTable";
import { Card } from "@/components/ui/card";

function Page() {
  return (
    <GovernanceFetchPage
      title="Compliance / LGPD"
      section="compliance"
      endpoint="/api/governance/compliance"
      render={(raw) => {
        const data = raw as {
          retentionDays?: number;
          consentVersion?: string;
          piiFlaggedPrompts?: number;
          consentRecords?: number;
          lgpdRequests?: Array<Record<string, unknown>>;
        };
        return (
          <div className="space-y-4">
            <KpiGrid
              items={[
                { label: "Retenção (dias)", value: data.retentionDays ?? 90 },
                { label: "Versão consentimento", value: data.consentVersion ?? "—" },
                { label: "Prompts com PII (flag)", value: data.piiFlaggedPrompts ?? 0 },
                { label: "Registros de consentimento", value: data.consentRecords ?? 0 },
              ]}
            />
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Solicitações LGPD</h2>
              <DataTable
                columns={[
                  { key: "createdAt", label: "Data" },
                  { key: "requestType", label: "Tipo" },
                  { key: "status", label: "Status" },
                  { key: "userId", label: "Usuário" },
                ]}
                rows={(data.lgpdRequests || []).map((r) => ({
                  createdAt: r.createdAt ? new Date(String(r.createdAt)).toLocaleString("pt-BR") : "—",
                  requestType: String(r.requestType ?? "—"),
                  status: String(r.status ?? "—"),
                  userId: String(r.userId ?? "—"),
                }))}
              />
            </Card>
          </div>
        );
      }}
    />
  );
}

export default function GovernanceCompliancePage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
