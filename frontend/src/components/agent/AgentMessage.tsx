"use client";

import { AgentChartBlock } from "./AgentChartBlock";
import { AgentDataTable } from "./AgentDataTable";
import { AgentFollowUpSuggestions } from "./AgentFollowUpSuggestions";
import { AgentKpiRow } from "./AgentKpiRow";
import { AgentMarkdown } from "./AgentMarkdown";
import { AgentSourceBadge } from "./AgentSourceBadge";
import { AgentTurnUsage } from "./AgentUsageBar";
import { AgentAvatar } from "./AgentAvatar";
import { PendingActionCard, type PendingActionItem } from "./PendingActionCard";
import type { TokenUsage } from "@/lib/token-usage";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

import type { MessageAttachment } from "@/hooks/use-agent-messages";

type ResponseSource = {
  type: "knowledge" | "system" | "hybrid";
  label: string;
  tools_used?: string[];
  documents?: string[];
};

type MixedResponse = {
  type: string;
  markdown: string;
  charts?: { type: string; title: string; data: { name: string; value: number }[] }[];
  kpis?: { label: string; value: string | number }[];
  tables?: Record<string, unknown>[];
  sources?: ResponseSource[];
  follow_ups?: string[];
  insights?: string[];
  data_limitations?: string | null;
  route?: string | null;
  pending_actions?: PendingActionItem[];
};

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function AgentMessage({
  role,
  content,
  usage,
  createdAt,
  streaming,
  attachments,
  onFollowUpSelect,
  messageId,
  conversationId,
}: {
  role: "user" | "assistant";
  content: string | MixedResponse;
  usage?: TokenUsage;
  createdAt?: string;
  streaming?: boolean;
  attachments?: MessageAttachment[];
  onFollowUpSelect?: (text: string) => void;
  messageId?: string;
  conversationId?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const isUser = role === "user";

  async function copyText() {
    const text = typeof content === "string" ? content : content.markdown;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendFeedback(payload: { thumbs?: string; rating?: number }) {
    if (feedbackSent) return;
    await fetch("/api/governance/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId,
        conversationId,
        ...payload,
      }),
    });
    setFeedbackSent(true);
  }

  if (isUser) {
    return (
      <div className="group flex justify-end">
        <div className="relative max-w-[min(100%,52rem)] space-y-2">
          {attachments?.some((a) => a.mimeType.startsWith("image/")) ? (
            <div className="flex flex-wrap justify-end gap-2">
              {attachments
                .filter((a) => a.mimeType.startsWith("image/"))
                .map((a) => (
                  <img
                    key={a.id}
                    src={a.previewUrl || `/api/agent/attachments/${a.id}/file`}
                    alt={a.fileName}
                    className="max-h-48 max-w-full rounded-xl border border-[var(--color-border)] object-cover"
                  />
                ))}
            </div>
          ) : null}
          {attachments?.filter((a) => !a.mimeType.startsWith("image/")).length ? (
            <div className="flex flex-wrap justify-end gap-1">
              {attachments
                .filter((a) => !a.mimeType.startsWith("image/"))
                .map((a) => (
                  <span
                    key={a.id}
                    className="rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[10px] text-[var(--color-accent-glow)]"
                  >
                    {a.fileName}
                  </span>
                ))}
            </div>
          ) : null}
          <div className="rounded-2xl rounded-br-md bg-[var(--color-accent)]/18 px-4 py-2.5 text-[15px] leading-relaxed text-[var(--color-foreground)]">
            {typeof content === "string" ? content : content.markdown}
          </div>
          {createdAt ? (
            <span className="mt-1 block text-right text-[10px] text-[var(--color-muted)] opacity-0 transition-opacity group-hover:opacity-100">
              {formatTime(createdAt)}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  const mixed: MixedResponse & { usage?: TokenUsage } =
    typeof content === "object"
      ? content
      : { type: "mixed_response", markdown: content, charts: [], kpis: [] };
  const turnUsage = usage ?? mixed.usage;
  const hasCharts = (mixed.charts?.length ?? 0) > 0;
  const hasKpis = (mixed.kpis?.length ?? 0) > 0;
  const hasTables = (mixed.tables?.length ?? 0) > 0;
  const showDataSource = Boolean(mixed.route && mixed.route !== "documental");
  const sourceDocuments = mixed.sources?.flatMap((s) => s.documents ?? []) ?? [];
  const showSourceBadge = !sourceDocuments.length;

  return (
    <div className="group flex items-start gap-3">
      <AgentAvatar streaming={streaming && !mixed.markdown} />
      <div className="min-w-0 w-full flex-1">
        <div className="relative space-y-3 rounded-2xl rounded-tl-md border border-[var(--color-border)] bg-[var(--color-card)]/95 px-4 py-3.5 shadow-sm md:px-5">
          {showSourceBadge ? <AgentSourceBadge sources={mixed.sources} /> : null}
          {hasKpis ? <AgentKpiRow kpis={mixed.kpis || []} showDataSource={showDataSource} /> : null}
          {hasCharts
            ? mixed.charts?.map((c, i) => <AgentChartBlock key={i} chart={c as never} />)
            : null}
          {hasTables ? <AgentDataTable tables={mixed.tables} /> : null}
          <AgentMarkdown
            content={mixed.markdown}
            extraCitations={sourceDocuments}
            streaming={streaming}
          />
          {mixed.data_limitations ? (
            <p className="text-[10px] text-[var(--color-muted)] italic">{mixed.data_limitations}</p>
          ) : null}
          {!streaming ? (
            <AgentFollowUpSuggestions suggestions={mixed.follow_ups} onSelect={onFollowUpSelect} />
          ) : null}
          {!streaming && mixed.pending_actions?.length ? (
            <PendingActionCard actions={mixed.pending_actions} />
          ) : null}
          {streaming ? (
            <span className="inline-block h-4 w-0.5 animate-pulse bg-[var(--color-accent-glow)]" aria-hidden />
          ) : null}
          <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)]/50 pt-2 opacity-60 transition-opacity group-hover:opacity-100">
            <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
              {createdAt ? <span>{formatTime(createdAt)}</span> : null}
              <AgentTurnUsage usage={turnUsage} />
            </div>
            <div className="flex items-center gap-1">
              {!streaming && !feedbackSent ? (
                <>
                  <button type="button" title="Útil" className="rounded p-1 hover:bg-[var(--color-card-hover)]" onClick={() => sendFeedback({ thumbs: "up", rating: 5 })}>👍</button>
                  <button type="button" title="Não útil" className="rounded p-1 hover:bg-[var(--color-card-hover)]" onClick={() => sendFeedback({ thumbs: "down", rating: 1 })}>👎</button>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" title={`${n} estrelas`} className="rounded px-0.5 text-[10px] hover:bg-[var(--color-card-hover)]" onClick={() => sendFeedback({ rating: n, thumbs: n >= 4 ? "up" : "down" })}>
                      {n <= 3 ? "☆" : "★"}
                    </button>
                  ))}
                </>
              ) : feedbackSent ? (
                <span className="text-[10px] text-[var(--color-muted)]">Obrigado pelo feedback</span>
              ) : null}
              {!streaming && mixed.markdown ? (
                <button
                  type="button"
                  onClick={copyText}
                  className="rounded p-1 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-foreground)]"
                  title="Copiar resposta"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
