"use client";

import { AgentMessage } from "./AgentMessage";
import { AgentAvatar } from "./AgentAvatar";
import type { AgentMessageItem } from "@/hooks/use-agent-messages";

type Props = {
  messages: AgentMessageItem[];
  conversationId?: string | null;
  onRetry?: (clientId: string, text: string) => void;
  onFollowUpSelect?: (text: string) => void;
};

export function AgentMessageList({ messages, conversationId, onRetry, onFollowUpSelect }: Props) {
  return (
    <div className="w-full space-y-8 py-4">
      {messages.map((m) => {
        const text = typeof m.content === "string" ? m.content : "";
        const isStreaming = m.status === "streaming";
        const isFailed = m.status === "failed";

        if (isStreaming && m.role === "assistant" && !text) {
          return (
            <div key={m.clientId} className="flex items-start gap-3">
              <AgentAvatar streaming />
              <div className="min-w-0 w-full flex-1 space-y-2 rounded-2xl rounded-tl-md border border-[var(--color-border)] bg-[var(--color-card)]/95 px-4 py-3.5 pt-4">
                <div className="h-3 w-32 animate-pulse rounded bg-[var(--color-border)]" />
                <div className="h-3 w-56 animate-pulse rounded bg-[var(--color-border)]/70" />
                <div className="h-3 w-44 animate-pulse rounded bg-[var(--color-border)]/50" />
              </div>
            </div>
          );
        }

        return (
          <div key={m.clientId}>
            <AgentMessage
              role={m.role}
              content={
                m.role === "assistant" && typeof m.content === "string" && isStreaming
                  ? { type: "mixed_response", markdown: m.content, charts: [], kpis: [] }
                  : (m.content as never)
              }
              usage={m.usage}
              createdAt={m.createdAt}
              streaming={isStreaming}
              attachments={m.attachments}
              onFollowUpSelect={onFollowUpSelect}
              messageId={m.serverId}
              conversationId={conversationId}
            />
            {isFailed ? (
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-danger)]">
                <span>{m.error || "Falha ao enviar"}</span>
                {onRetry && m.role === "user" ? (
                  <button
                    type="button"
                    className="underline hover:no-underline"
                    onClick={() => onRetry(m.clientId, text)}
                  >
                    Tentar novamente
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
