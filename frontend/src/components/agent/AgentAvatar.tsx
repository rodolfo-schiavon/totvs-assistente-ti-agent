"use client";

import { Bot, Loader2 } from "lucide-react";

export function AgentAvatar({ streaming }: { streaming?: boolean }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10"
      aria-hidden
    >
      {streaming ? (
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent-glow)]" />
      ) : (
        <Bot className="h-4 w-4 text-[var(--color-accent-glow)]" />
      )}
    </div>
  );
}
