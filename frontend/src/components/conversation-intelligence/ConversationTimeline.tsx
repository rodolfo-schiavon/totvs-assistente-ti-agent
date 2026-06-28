"use client";

import { Card } from "@/components/ui/card";
import { maskSensitiveText } from "@/lib/mask-sensitive";

type TimelineMessage = {
  id: string;
  role: string;
  content: unknown;
  createdAt: string;
  usage?: Record<string, unknown>;
};

export function ConversationTimeline({
  messages,
  onAudit,
  maskPii = true,
}: {
  messages: TimelineMessage[];
  onAudit?: (messageId: string) => void;
  maskPii?: boolean;
}) {
  return (
    <div className="space-y-4">
      {messages.map((m) => {
        const text =
          typeof m.content === "string"
            ? m.content
            : typeof m.content === "object" && m.content && "markdown" in (m.content as object)
              ? String((m.content as { markdown: string }).markdown)
              : JSON.stringify(m.content);
        const isUser = m.role === "user";
        return (
          <Card
            key={m.id}
            className={`p-4 ${isUser ? "border-[var(--color-accent)]/30" : "border-[var(--color-border)]"}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-[var(--color-muted)]">
                {isUser ? "Usuário" : "IA"} · {new Date(m.createdAt).toLocaleString("pt-BR")}
              </span>
              {!isUser && onAudit ? (
                <button
                  type="button"
                  className="text-xs text-[var(--color-accent-glow)] hover:underline"
                  onClick={() => onAudit(m.id)}
                >
                  Auditoria
                </button>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-foreground)]">
              {maskPii ? maskSensitiveText(text) : text}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
