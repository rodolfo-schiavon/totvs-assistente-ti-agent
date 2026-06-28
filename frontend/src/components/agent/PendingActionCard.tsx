"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, ShieldAlert } from "lucide-react";

export type PendingActionItem = {
  id: string;
  action_type: string;
  summary: string;
  risk: string;
  status: string;
  expires_at?: string | null;
};

type Props = {
  actions: PendingActionItem[];
  onResolved?: () => void;
};

const RISK_LABEL: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
};

export function PendingActionCard({ actions, onResolved }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const pending = actions.filter((a) => a.status === "pending" && !resolved[a.id]);

  if (!pending.length) return null;

  async function handle(id: string, approve: boolean) {
    setLoadingId(id);
    setError("");
    try {
      const res = await fetch(`/api/agent/actions/${id}/${approve ? "approve" : "reject"}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Falha ao processar ação.");
        return;
      }
      setResolved((r) => ({ ...r, [id]: approve ? "executed" : "rejected" }));
      onResolved?.();
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {pending.map((a) => (
        <div
          key={a.id}
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <div className="mb-2 flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-amber-100">Ação pendente de aprovação</p>
              <p className="mt-1 text-[var(--color-foreground-muted)]">{a.summary}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Tipo: <code>{a.action_type}</code> · Risco: {RISK_LABEL[a.risk] || a.risk}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={loadingId === a.id}
              onClick={() => handle(a.id, true)}
            >
              {loadingId === a.id ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              Aprovar e executar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loadingId === a.id}
              onClick={() => handle(a.id, false)}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Rejeitar
            </Button>
          </div>
        </div>
      ))}
      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
