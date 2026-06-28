"use client";

import { BookOpen } from "lucide-react";

export function AgentDocCitations({ titles }: { titles: string[] }) {
  if (!titles.length) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)]/80 pt-3">
      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        <BookOpen className="h-3 w-3" aria-hidden />
        Fontes
      </span>
      {titles.map((title) => (
        <span
          key={title}
          className="inline-flex max-w-full items-center rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-2.5 py-0.5 text-xs text-[var(--color-accent-glow)]"
          title={title}
        >
          <span className="truncate">{title}</span>
        </span>
      ))}
    </div>
  );
}
