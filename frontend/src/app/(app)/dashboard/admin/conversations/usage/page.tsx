"use client";

import { Suspense } from "react";
import { ConversationFetchPage } from "@/components/conversation-intelligence/ConversationFetchPage";
import { Card } from "@/components/ui/card";

function Content() {
  return (
    <ConversationFetchPage
      title="Análise de Utilização"
      endpoint="/api/conversation-intelligence/usage"
      render={(raw) => {
        const data = raw as {
          byUser?: Array<{ userId: string; _count: { _all: number }; _sum: { totalTokens: number } }>;
          byDepartment?: Array<{ department: string; _count: { _all: number } }>;
        };
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-2 font-semibold">Top usuários</h2>
              <ul className="space-y-1 text-sm">
                {(data.byUser || []).map((u) => (
                  <li key={u.userId} className="flex justify-between">
                    <span>{u.userId.slice(0, 8)}…</span>
                    <span>{u._count._all} conv · {u._sum.totalTokens} tok</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h2 className="mb-2 font-semibold">Top departamentos</h2>
              <ul className="space-y-1 text-sm">
                {(data.byDepartment || []).map((d) => (
                  <li key={d.department || "—"} className="flex justify-between">
                    <span>{d.department || "—"}</span>
                    <span>{d._count._all}</span>
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

export default function ConversationsUsagePage() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
