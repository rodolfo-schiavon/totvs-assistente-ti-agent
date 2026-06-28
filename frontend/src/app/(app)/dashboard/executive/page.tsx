"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileText, Clock, BarChart3, Coins, Users } from "lucide-react";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";
import { canViewManagementReports, isAdmin } from "@/lib/roles";

type DashboardStats = {
  scope: "personal" | "organization";
  role: string;
  conversations: number;
  userMessages: number;
  documents: number | null;
  pendingDocuments: number | null;
  avgLatencyMs: number;
  activeUsers?: number;
  topAnalysisTypes: { type: string; count: number }[];
  tokenUsage?: {
    periodDays: number;
    totalTokens: number;
    estimatedCostUsd: number;
    assistantMessages: number;
    activeUsers?: number;
  } | null;
};

export default function LegalDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/legal/dashboard")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const s = stats || {
    scope: "personal" as const,
    role: "advogado",
    conversations: 0,
    userMessages: 0,
    documents: null,
    pendingDocuments: null,
    avgLatencyMs: 0,
    topAnalysisTypes: [],
    tokenUsage: null,
  };

  const orgView = s.scope === "organization";
  const showAdminLinks = isAdmin(s.role);
  const showReports = canViewManagementReports(s.role);
  const showKnowledgeLink = canViewManagementReports(s.role);

  const kpis = orgView
    ? [
        { label: "Conversas (org.)", value: s.conversations, icon: MessageSquare },
        { label: "Mensagens enviadas", value: s.userMessages, icon: BarChart3 },
        { label: "Documentos na base", value: s.documents ?? 0, icon: FileText },
        { label: "Usuários ativos", value: s.activeUsers ?? 0, icon: Users },
      ]
    : [
        { label: "Minhas conversas", value: s.conversations, icon: MessageSquare },
        { label: "Mensagens (mês)", value: s.userMessages, icon: BarChart3 },
        {
          label: "Tokens (30 dias)",
          value: s.tokenUsage ? formatTokenCount(s.tokenUsage.totalTokens) : "0",
          icon: Coins,
        },
        {
          label: "Custo est. (30 dias)",
          value: s.tokenUsage ? formatCostUsd(s.tokenUsage.estimatedCostUsd) : "$0.00",
          icon: Clock,
        },
      ];

  return (
    <div className="space-y-6">
      <Header title={orgView ? "Dashboard — visão consolidada" : "Dashboard"} compact />
      <p className="text-sm text-[var(--color-foreground-muted)]">
        {orgView
          ? "Visão gerencial do assistente de TI. Dados agregados — uso autorizado apenas."
          : "Seu uso pessoal do assistente. Conversas de outros usuários não são exibidas."}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <Icon className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      {orgView && s.tokenUsage ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Consumo de IA (últimos {s.tokenUsage.periodDays} dias)</h2>
          <div className="mt-3 flex flex-wrap gap-6 text-sm">
            <span>
              Tokens: <strong>{formatTokenCount(s.tokenUsage.totalTokens)}</strong>
            </span>
            <span>
              Custo estimado: <strong>{formatCostUsd(s.tokenUsage.estimatedCostUsd)}</strong>
            </span>
            <span>
              Respostas IA: <strong>{s.tokenUsage.assistantMessages}</strong>
            </span>
            {s.avgLatencyMs > 0 ? (
              <span>
                Latência média: <strong>{s.avgLatencyMs} ms</strong>
              </span>
            ) : null}
          </div>
        </Card>
      ) : null}

      {orgView && (s.pendingDocuments ?? 0) > 0 && showKnowledgeLink ? (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          {s.pendingDocuments} documento(s) aguardando ingestão na base de conhecimento.
          <Link
            href="/dashboard/admin/knowledge"
            className="ml-2 text-[var(--color-accent-glow)] underline"
          >
            Ver base
          </Link>
        </Card>
      ) : null}

      {orgView && s.topAnalysisTypes.length > 0 ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Tipos de análise (mês atual)</h2>
          <ul className="mt-3 space-y-2">
            {s.topAnalysisTypes.map((row) => (
              <li key={row.type} className="flex justify-between text-sm">
                <span>{row.type}</span>
                <span className="tabular-nums text-[var(--color-muted)]">{row.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/agent">Abrir Agente IA</Link>
        </Button>
        {showReports ? (
          <Button asChild variant="outline">
            <Link href="/dashboard/management/reports">Relatórios de uso</Link>
          </Button>
        ) : null}
        {showKnowledgeLink ? (
          <Button asChild variant="outline">
            <Link href="/dashboard/admin/knowledge">Base de conhecimento</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
