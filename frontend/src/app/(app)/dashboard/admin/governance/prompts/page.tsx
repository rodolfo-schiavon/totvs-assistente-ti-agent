"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { DataTable } from "@/components/governance/DataTable";
import { Card } from "@/components/ui/card";

function Page() {
  return (
    <GovernanceFetchPage
      title="Analytics de Prompts"
      section="prompts"
      endpoint="/api/governance/prompts"
      render={(raw) => {
        const data = raw as { items?: Array<Record<string, unknown>> };
        return (
          <Card className="p-4">
            <DataTable
              columns={[
                { key: "createdAt", label: "Data" },
                { key: "promptCategory", label: "Categoria" },
                { key: "analysisType", label: "Tipo análise" },
                { key: "containsPii", label: "PII" },
                { key: "promptHash", label: "Hash" },
              ]}
              rows={(data.items || []).map((i) => ({
                createdAt: i.createdAt ? new Date(String(i.createdAt)).toLocaleString("pt-BR") : "—",
                promptCategory: String(i.promptCategory ?? "—"),
                analysisType: String(i.analysisType ?? "—"),
                containsPii: i.containsPii ? "Sim" : "Não",
                promptHash: String(i.promptHash ?? "").slice(0, 12),
              }))}
            />
          </Card>
        );
      }}
    />
  );
}

export default function GovernancePromptsPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
