"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ConversationTimeline } from "@/components/conversation-intelligence/ConversationTimeline";
import { MessageAuditPanel } from "@/components/conversation-intelligence/MessageAuditPanel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";

function DetailInner() {
  const params = useParams();
  const id = String(params.id);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [audit, setAudit] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/conversation-intelligence/conversations/${id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  async function loadAudit(messageId: string) {
    const r = await fetch(`/api/conversation-intelligence/conversations/${id}/messages/${messageId}/audit`);
    setAudit(await r.json());
  }

  async function anonymize() {
    if (!confirm("Anonimizar esta conversa? Ação irreversível para conteúdo.")) return;
    await fetch(`/api/conversation-intelligence/conversations/${id}/anonymize`, { method: "POST" });
    window.location.reload();
  }

  function exportText() {
    window.open(`/api/conversation-intelligence/conversations/${id}/export`, "_blank");
  }

  async function deleteConversation() {
    if (!confirm("Excluir esta conversa? Apenas administradores podem executar esta ação.")) return;
    const res = await fetch(`/api/conversation-intelligence/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Não foi possível excluir.");
      return;
    }
    window.location.href = "/dashboard/admin/conversations/list";
  }

  if (loading || !data) {
    return (
      <main className="p-6">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  const conv = data.conversation as Record<string, unknown>;
  const metrics = conv.metrics as Record<string, unknown> | undefined;
  const user = conv.user as { username?: string; role?: string; department?: string };
  const timeline = (data.timeline as Array<Record<string, unknown>>) || [];

  return (
    <>
      <Header title="Detalhe da conversa" />
      <main className="grid gap-6 p-4 md:grid-cols-[1fr_320px] md:p-6">
        <div className="space-y-4">
          <Card className="p-4">
            <h1 className="text-xl font-bold">{String(conv.title || "Conversa")}</h1>
            <p className="text-sm text-[var(--color-muted)]">
              {user?.username} · {user?.department || user?.role} · Organização
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
              <span>Tokens: {formatTokenCount(Number(metrics?.totalTokens ?? 0))}</span>
              <span>Custo: {formatCostUsd(Number(metrics?.estimatedCostUsd ?? 0))}</span>
              <span>Modelo: {String(metrics?.primaryModel ?? "—")}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportText}>
                Exportar texto
              </Button>
              <Button size="sm" variant="outline" onClick={anonymize}>
                Anonimizar (LGPD)
              </Button>
              <Button size="sm" variant="danger" onClick={deleteConversation}>
                Excluir (admin)
              </Button>
            </div>
          </Card>
          <ConversationTimeline
            messages={timeline.map((m) => ({
              id: String(m.id),
              role: String(m.role),
              content: m.content,
              createdAt: String(m.createdAt),
              usage: m.usage as Record<string, unknown> | undefined,
            }))}
            onAudit={loadAudit}
          />
        </div>
        <MessageAuditPanel audit={audit} />
      </main>
    </>
  );
}

export default function ConversationDetailPage() {
  return (
    <Suspense>
      <DetailInner />
    </Suspense>
  );
}
