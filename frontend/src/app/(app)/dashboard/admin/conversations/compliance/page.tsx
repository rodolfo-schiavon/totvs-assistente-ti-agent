"use client";

import { Suspense } from "react";
import { ConversationFetchPage } from "@/components/conversation-intelligence/ConversationFetchPage";
import { Card } from "@/components/ui/card";

function Content() {
  return (
    <ConversationFetchPage
      title="Compliance / LGPD"
      endpoint="/api/conversation-intelligence/compliance"
      render={(raw) => {
        const data = raw as {
          retentionDays?: number;
          views?: Array<Record<string, unknown>>;
          exports?: Array<Record<string, unknown>>;
        };
        return (
          <div className="space-y-4">
            <Card className="p-4 text-sm">Retenção configurada: {data.retentionDays ?? 90} dias</Card>
            <Card className="p-4">
              <h2 className="mb-2 font-semibold">Visualizações recentes</h2>
              <ul className="space-y-1 text-xs text-[var(--color-muted)]">
                {(data.views || []).slice(0, 15).map((v) => (
                  <li key={String(v.id)}>
                    {new Date(String(v.createdAt)).toLocaleString("pt-BR")} — conv {String(v.conversationId).slice(0, 8)}…
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h2 className="mb-2 font-semibold">Exportações recentes</h2>
              <ul className="space-y-1 text-xs text-[var(--color-muted)]">
                {(data.exports || []).slice(0, 15).map((e) => (
                  <li key={String(e.id)}>
                    {String(e.format)} — {String(e.recordCount)} registros
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

export default function ConversationsCompliancePage() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
