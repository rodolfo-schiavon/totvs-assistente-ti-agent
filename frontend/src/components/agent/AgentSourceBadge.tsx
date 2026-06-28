"use client";

import { BookOpen, Database, Layers } from "lucide-react";

type Source = {
  type: "knowledge" | "system" | "hybrid";
  label: string;
};

const ICONS = {
  knowledge: BookOpen,
  system: Database,
  hybrid: Layers,
} as const;

export function AgentSourceBadge({ sources }: { sources?: Source[] }) {
  if (!sources?.length) return null;
  const primary = sources[0];
  const Icon = ICONS[primary.type] || Database;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-background)]/80 px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
        <Icon className="h-3 w-3" />
        {primary.label}
      </span>
    </div>
  );
}
