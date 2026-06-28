"use client";

export function AgentFollowUpSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions?: string[];
  onSelect?: (text: string) => void;
}) {
  if (!suggestions?.length || !onSelect) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)]/40 hover:text-[var(--color-foreground)]"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
