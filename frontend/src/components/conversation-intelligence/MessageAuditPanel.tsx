"use client";

import { Card } from "@/components/ui/card";

export function MessageAuditPanel({ audit }: { audit: Record<string, unknown> | null }) {
  if (!audit) {
    return <Card className="p-4 text-sm text-[var(--color-muted)]">Selecione uma mensagem para ver a auditoria.</Card>;
  }

  const obs = audit.observability as Record<string, unknown> | null | undefined;
  const rag = audit.rag as Record<string, unknown> | null | undefined;

  return (
    <Card className="space-y-3 p-4 text-sm">
      <h3 className="font-semibold text-[var(--color-foreground)]">Auditoria da mensagem</h3>
      {obs ? (
        <div className="space-y-1 text-[var(--color-muted)]">
          <p>Modelo: {String(obs.provider)}/{String(obs.model)}</p>
          <p>Tokens: {String(obs.totalTokens)} · Latência: {String(obs.latencyMs)} ms</p>
          <p>Rota: {String(obs.route)} · Status: {String(obs.status)}</p>
          <p>Ferramentas: {String(obs.toolsJson || "—")}</p>
        </div>
      ) : (
        <p className="text-[var(--color-muted)]">Sem registro de observabilidade para esta mensagem.</p>
      )}
      {rag ? (
        <div className="border-t border-[var(--color-border)] pt-2 text-[var(--color-muted)]">
          <p>RAG: docs {String(rag.docsRetrieved)} · chunks {String(rag.chunksRetrieved)}</p>
          <p>Similaridade média: {String(rag.avgSimilarity ?? "—")}</p>
        </div>
      ) : null}
    </Card>
  );
}
