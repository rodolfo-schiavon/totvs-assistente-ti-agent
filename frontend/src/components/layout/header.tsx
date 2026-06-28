"use client";

import { cn } from "@/lib/utils";

export function Header({
  title,
  subtitle,
  compact,
}: {
  title: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        compact ? "mb-2" : "mb-4"
      )}
    >
      <div>
        <h1
          className={cn(
            "font-bold tracking-tight text-[var(--color-foreground)]",
            compact ? "text-lg" : "text-2xl"
          )}
        >
          {title}
        </h1>
        {subtitle && !compact && (
          <p className="text-xs text-[var(--color-muted)]">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
