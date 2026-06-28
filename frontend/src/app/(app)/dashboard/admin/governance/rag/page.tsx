"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { DataTable } from "@/components/governance/DataTable";
import { Card } from "@/components/ui/card";

function Page() {
  return (
    <GovernanceFetchPage
      title="Analytics de RAG"
      section="rag"
      endpoint="/api/governance/rag"
      render={(raw) => {
        const data = raw as { items?: Array<Record<string, unknown>> };
        return (
          <Card className="p-4">
            <DataTable
              columns={[
                { key: "createdAt", label: "Data" },
                { key: "route", label: "Rota" },
                { key: "docsRetrieved", label: "Docs" },
                { key: "vfsFilesCount", label: "VFS" },
                { key: "success", label: "Sucesso" },
              ]}
              rows={(data.items || []).map((i) => ({
                createdAt: i.createdAt ? new Date(String(i.createdAt)).toLocaleString("pt-BR") : "—",
                route: String(i.route ?? "—"),
                docsRetrieved: String(i.docsRetrieved ?? 0),
                vfsFilesCount: String(i.vfsFilesCount ?? 0),
                success: i.success ? "Sim" : "Não",
              }))}
            />
          </Card>
        );
      }}
    />
  );
}

export default function GovernanceRagPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
