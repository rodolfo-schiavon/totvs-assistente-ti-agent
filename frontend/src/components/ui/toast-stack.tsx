"use client";

import { useEffect } from "react";
import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  variant: "success" | "error" | "info";
};

export function ToastStack({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (!items.length) return;
    const timers = items.map((t) =>
      setTimeout(() => onDismiss(t.id), t.variant === "error" ? 12000 : 8000)
    );
    return () => timers.forEach(clearTimeout);
  }, [items, onDismiss]);

  if (!items.length) return null;

  return (
    <div
      className="fixed right-4 top-4 z-[100] flex max-w-sm flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="Notificações"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md",
            t.variant === "success" &&
              "border-emerald-500/30 bg-emerald-500/10 text-[var(--color-foreground)]",
            t.variant === "error" &&
              "border-red-500/30 bg-red-500/10 text-[var(--color-foreground)]",
            t.variant === "info" &&
              "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)]"
          )}
        >
          {t.variant === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : t.variant === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          ) : (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--color-muted)]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t.title}</p>
            {t.message ? (
              <p className="mt-0.5 text-xs text-[var(--color-foreground-muted)]">{t.message}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 rounded p-1 text-[var(--color-muted)] hover:bg-black/5"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
