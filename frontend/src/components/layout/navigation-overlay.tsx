"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useUiStore } from "@/store/ui-store";

export function NavigationOverlay() {
  const pathname = usePathname();
  const pending = useUiStore((s) => s.pendingNavigation);
  const setPending = useUiStore((s) => s.setPendingNavigation);

  useEffect(() => {
    setPending(null);
  }, [pathname, setPending]);

  const show = Boolean(pending && pending !== pathname);

  if (!show) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-[var(--color-background)]/75 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label="Carregando página"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/95 px-6 py-5 shadow-lg">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent-glow)]" />
        <p className="text-sm text-[var(--color-muted)]">Carregando…</p>
      </div>
    </div>
  );
}
