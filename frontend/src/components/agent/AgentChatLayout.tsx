"use client";

import { ReactNode } from "react";
import { AgentUsageBar } from "./AgentUsageBar";
import type { TokenUsage } from "@/lib/token-usage";
import { Pencil, Check, X } from "lucide-react";
import { useState } from "react";

type Props = {
  title: string;
  subtitle?: string;
  sessionUsage: TokenUsage | null;
  sessionTurns: number;
  children: ReactNode;
  composer: ReactNode;
  onRename?: (title: string) => Promise<void>;
  knowledgeMode?: boolean;
  onKnowledgeModeChange?: (v: boolean) => void;
};

export function AgentChatLayout({
  title,
  subtitle,
  sessionUsage,
  sessionTurns,
  children,
  composer,
  onRename,
  knowledgeMode,
  onKnowledgeModeChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  async function saveTitle() {
    const t = draft.trim();
    if (!t || !onRename) {
      setEditing(false);
      return;
    }
    await onRename(t);
    setEditing(false);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <button type="button" onClick={saveTitle} className="text-[var(--color-accent-glow)]">
                <Check className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-[var(--color-muted)]">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold">{title}</h1>
              {onRename ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(title);
                    setEditing(true);
                  }}
                  className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  title="Renomear conversa"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          )}
          {subtitle ? <p className="text-xs text-[var(--color-muted)]">{subtitle}</p> : null}
          {onKnowledgeModeChange ? (
            <button
              type="button"
              onClick={() => onKnowledgeModeChange(!knowledgeMode)}
              className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                knowledgeMode
                  ? "bg-[var(--color-accent)]/25 text-[var(--color-accent-glow)]"
                  : "bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {knowledgeMode ? "Modo documentos · ativo" : "Modo ops · ativo (cluster/MCP)"}
            </button>
          ) : null}
        </div>
        <AgentUsageBar sessionUsage={sessionUsage} sessionTurns={sessionTurns} />
      </header>

      <div className="flex-1 overflow-y-auto">{children}</div>
      <div className="shrink-0">{composer}</div>
    </div>
  );
}
