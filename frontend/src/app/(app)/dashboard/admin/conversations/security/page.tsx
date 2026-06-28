"use client";

import { Suspense } from "react";
import { ConversationFetchPage } from "@/components/conversation-intelligence/ConversationFetchPage";
import { SeverityBadge } from "@/components/governance/SeverityBadge";
import { Card } from "@/components/ui/card";

function Content() {
  return (
    <ConversationFetchPage
      title="Monitoramento de Segurança"
      endpoint="/api/conversation-intelligence/security"
      render={(raw) => {
        const data = raw as { events?: Array<Record<string, unknown>> };
        return (
          <div className="space-y-3">
            {(data.events || []).map((e) => (
              <Card key={String(e.id)} className="p-4">
                <div className="flex items-center gap-2">
                  <SeverityBadge value={String(e.severity)} />
                  <span className="text-xs text-[var(--color-muted)]">{String(e.eventType)}</span>
                </div>
                <p className="mt-1 text-sm">{String(e.pattern || e.detailsJson || "")}</p>
              </Card>
            ))}
          </div>
        );
      }}
    />
  );
}

export default function ConversationsSecurityPage() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
