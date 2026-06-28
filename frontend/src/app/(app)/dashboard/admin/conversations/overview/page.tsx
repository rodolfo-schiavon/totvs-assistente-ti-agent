"use client";

import { Suspense } from "react";
import { ConversationFetchPage } from "@/components/conversation-intelligence/ConversationFetchPage";
import { KpiGrid } from "@/components/governance/KpiGrid";
import { TimeSeriesChart } from "@/components/governance/TimeSeriesChart";
import { Card } from "@/components/ui/card";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";

function Content() {
  return (
    <ConversationFetchPage
      title="Dashboard Executivo"
      endpoint="/api/conversation-intelligence/overview"
      render={(raw) => {
        const data = raw as {
          kpis: Record<string, number>;
          series: { daily: Array<{ date: string; conversations: number; tokens: number; costUsd: number }> };
        };
        const k = data.kpis || {};
        return (
          <div className="space-y-6">
            <KpiGrid
              items={[
                { label: "Total conversas", value: k.totalConversations ?? 0 },
                { label: "Total mensagens", value: k.totalMessages ?? 0 },
                { label: "Hoje", value: k.conversationsToday ?? 0 },
                { label: "7 dias", value: k.conversations7d ?? 0 },
                { label: "30 dias", value: k.conversations30d ?? 0 },
                { label: "Usuários ativos", value: k.activeUsers ?? 0 },
                { label: "Tokens", value: formatTokenCount(k.totalTokens ?? 0) },
                { label: "Custo estimado", value: formatCostUsd(k.estimatedCostUsd ?? 0) },
                { label: "Com RAG", value: k.withRag ?? 0 },
                { label: "Com ferramentas", value: k.withTools ?? 0 },
                { label: "Feedback negativo", value: k.negativeFeedback ?? 0 },
              ]}
            />
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Conversas por dia</h2>
              <TimeSeriesChart
                data={(data.series?.daily || []).map((d) => ({
                  date: new Date(d.date).toLocaleDateString("pt-BR"),
                  value: d.conversations,
                }))}
              />
            </Card>
          </div>
        );
      }}
    />
  );
}

export default function ConversationsOverviewPage() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
