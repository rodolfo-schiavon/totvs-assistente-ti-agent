"use client";

import { Suspense } from "react";
import { GovernanceFetchPage } from "@/components/governance/GovernanceFetchPage";
import { DataTable } from "@/components/governance/DataTable";
import { Card } from "@/components/ui/card";

function Page() {
  return (
    <GovernanceFetchPage
      title="Feedback dos Usuários"
      section="feedback"
      endpoint="/api/governance/feedback"
      render={(raw) => {
        const data = raw as {
          summary?: { _avg?: { rating?: number }; _count?: { _all?: number } };
          items?: Array<Record<string, unknown> & { user?: { username?: string } }>;
        };
        return (
          <div className="space-y-4">
            <Card className="p-4 text-sm">
              Média: {data.summary?._avg?.rating?.toFixed(1) ?? "—"} · Total: {data.summary?._count?._all ?? 0}
            </Card>
            <Card className="p-4">
              <DataTable
                columns={[
                  { key: "createdAt", label: "Data" },
                  { key: "username", label: "Usuário" },
                  { key: "rating", label: "Estrelas" },
                  { key: "thumbs", label: "👍/👎" },
                  { key: "comment", label: "Comentário" },
                ]}
                rows={(data.items || []).map((i) => ({
                  createdAt: i.createdAt ? new Date(String(i.createdAt)).toLocaleString("pt-BR") : "—",
                  username: i.user?.username ?? "—",
                  rating: String(i.rating ?? "—"),
                  thumbs: String(i.thumbs ?? "—"),
                  comment: String(i.comment ?? "").slice(0, 120),
                }))}
              />
            </Card>
          </div>
        );
      }}
    />
  );
}

export default function GovernanceFeedbackPage() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  );
}
