"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Gauge } from "lucide-react";
import { formatCostUsd, formatTokenCount, usageSourceLabel, type TokenUsage } from "@/lib/token-usage";

export function AgentUsageBar({
  sessionUsage,
  sessionTurns,
}: {
  sessionUsage: TokenUsage | null;
  sessionTurns: number;
}) {
  const [open, setOpen] = useState(false);
  if (!sessionUsage || sessionTurns === 0) return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[var(--color-muted)]/60 transition-colors hover:bg-[var(--color-card)] hover:text-[var(--color-muted)]"
        title="Uso de tokens da sessão"
        aria-label="Ver uso de tokens da sessão"
      >
        <Gauge className="h-3.5 w-3.5" />
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[11px] text-[var(--color-muted)] shadow-lg">
          <p className="font-medium text-[var(--color-foreground-muted)]">
            {formatTokenCount(sessionUsage.total_tokens)} tokens · ~{formatCostUsd(sessionUsage.estimated_cost_usd)}
          </p>
          <p className="mt-1">
            {formatTokenCount(sessionUsage.input_tokens)} in · {formatTokenCount(sessionUsage.output_tokens)} out ·{" "}
            {sessionTurns} {sessionTurns === 1 ? "msg" : "msgs"}
          </p>
          {sessionUsage.model ? (
            <p className="mt-1 truncate text-[10px]">
              {sessionUsage.provider}/{sessionUsage.model}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AgentTurnUsage({ usage }: { usage?: TokenUsage }) {
  if (!usage) return null;

  return (
    <span
      className="hidden text-[10px] text-[var(--color-muted)]/70 sm:inline"
      title={`${formatTokenCount(usage.input_tokens)} in · ${formatTokenCount(usage.output_tokens)} out · ~${formatCostUsd(usage.estimated_cost_usd)}${usage.llm_calls ? ` · ${usage.llm_calls} LLM` : ""} · ${usageSourceLabel(usage.source)}`}
    >
      · {formatTokenCount(usage.total_tokens)} tk
    </span>
  );
}
