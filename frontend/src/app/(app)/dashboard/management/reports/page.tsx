"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";
import { ROLE_LABELS, type LegalRole } from "@/lib/roles";

type UsageRow = {
  userId: string;
  username: string;
  role: string;
  conversations: number;
  assistantMessages: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

type ConvRow = {
  conversationId: string;
  title: string;
  username: string;
  role: string;
  assistantMessages: number;
  totalTokens: number;
  estimatedCostUsd: number;
  lastActivityAt: string;
};

type Report = {
  periodDays: number;
  since: string;
  summary: {
    assistantMessages: number;
    totalTokens: number;
    estimatedCostUsd: number;
    activeUsers: number;
    activeConversations: number;
  };
  byUser: UsageRow[];
  byConversation: ConvRow[];
};

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

export default function ManagementReportsPage() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (period: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/management/reports/usage?days=${period}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar relatório");
      setReport(data);
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  return (
    <div className="space-y-6">
      <Header title="Relatórios de uso" compact />
      <p className="text-sm text-[var(--color-foreground-muted)]">
        Visão consolidada de consumo de tokens e custos estimados (BYOK). Dados agregados — sem
        conteúdo de conversas.
      </p>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.days}
            type="button"
            variant={days === p.days ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-red-500/30 p-4 text-sm text-red-400">{error}</Card>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs uppercase text-[var(--color-muted)]">Custo estimado</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatCostUsd(report.summary.estimatedCostUsd)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-[var(--color-muted)]">Tokens</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatTokenCount(report.summary.totalTokens)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-[var(--color-muted)]">Usuários ativos</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{report.summary.activeUsers}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-[var(--color-muted)]">Conversas</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {report.summary.activeConversations}
              </p>
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-sm font-semibold">Por usuário</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted)]">
                    <th className="px-4 py-2">Usuário</th>
                    <th className="px-4 py-2">Perfil</th>
                    <th className="px-4 py-2 text-right">Conversas</th>
                    <th className="px-4 py-2 text-right">Respostas IA</th>
                    <th className="px-4 py-2 text-right">Tokens</th>
                    <th className="px-4 py-2 text-right">Custo est.</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byUser.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-muted)]">
                        Nenhum uso registrado no período.
                      </td>
                    </tr>
                  ) : (
                    report.byUser.map((row) => (
                      <tr key={row.userId} className="border-b border-[var(--color-border)]/50">
                        <td className="px-4 py-2 font-medium">{row.username}</td>
                        <td className="px-4 py-2 text-[var(--color-muted)]">
                          {ROLE_LABELS[row.role as LegalRole] || row.role}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.conversations}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.assistantMessages}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatTokenCount(row.totalTokens)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatCostUsd(row.estimatedCostUsd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-sm font-semibold">Por conversa</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted)]">
                    <th className="px-4 py-2">Conversa</th>
                    <th className="px-4 py-2">Usuário</th>
                    <th className="px-4 py-2 text-right">Respostas IA</th>
                    <th className="px-4 py-2 text-right">Tokens</th>
                    <th className="px-4 py-2 text-right">Custo est.</th>
                    <th className="px-4 py-2">Última atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byConversation.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-muted)]">
                        Nenhuma conversa com uso no período.
                      </td>
                    </tr>
                  ) : (
                    report.byConversation.slice(0, 100).map((row) => (
                      <tr key={row.conversationId} className="border-b border-[var(--color-border)]/50">
                        <td className="max-w-[200px] truncate px-4 py-2" title={row.title}>
                          {row.title}
                        </td>
                        <td className="px-4 py-2">{row.username}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.assistantMessages}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatTokenCount(row.totalTokens)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatCostUsd(row.estimatedCostUsd)}
                        </td>
                        <td className="px-4 py-2 text-xs text-[var(--color-muted)]">
                          {new Date(row.lastActivityAt).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {report.byConversation.length > 100 ? (
              <p className="px-4 py-2 text-xs text-[var(--color-muted)]">
                Exibindo as 100 conversas com maior custo no período.
              </p>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
