"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ToastItem } from "@/components/ui/toast-stack";

type DocSnapshot = {
  status: string;
  vfsSyncStatus?: string;
  title: string;
};

/** Detecta transições de status na KB e emite toasts (ingestão pronta, VFS synced, falha). */
export function useKbStatusNotifications(
  docs: Array<{ id: string; title: string; status: string; vfsSyncStatus?: string; error?: string }>
) {
  const prevRef = useRef<Map<string, DocSnapshot>>(new Map());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const initializedRef = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      if (docs.length > 0) {
        prevRef.current = new Map(
          docs.map((d) => [d.id, { status: d.status, vfsSyncStatus: d.vfsSyncStatus, title: d.title }])
        );
        initializedRef.current = true;
      }
      return;
    }

    const prev = prevRef.current;
    const next = new Map<string, DocSnapshot>();

    for (const d of docs) {
      next.set(d.id, { status: d.status, vfsSyncStatus: d.vfsSyncStatus, title: d.title });
      const old = prev.get(d.id);
      if (!old) continue;

      const wasProcessing = old.status === "pending" || old.status === "processing";
      const nowReady = d.status === "ready";
      const nowFailed = d.status === "failed";
      const vfsSynced = d.vfsSyncStatus === "synced";
      const wasVfsPending =
        old.vfsSyncStatus === "pending" || old.vfsSyncStatus === undefined || old.vfsSyncStatus === "";

      if (wasProcessing && nowReady) {
        setToasts((t) => [
          ...t,
          {
            id: `${d.id}-ready-${Date.now()}`,
            variant: "success",
            title: "Documento indexado",
            message: `"${d.title}" — texto extraído com sucesso.`,
          },
        ]);
      }

      if (nowReady && wasVfsPending && vfsSynced && old.vfsSyncStatus !== "synced") {
        setToasts((t) => [
          ...t,
          {
            id: `${d.id}-synced-${Date.now()}`,
            variant: "success",
            title: "Disponível para o agente",
            message: `"${d.title}" sincronizado na base (/legal-kb/).`,
          },
        ]);
      }

      if (wasProcessing && nowFailed) {
        setToasts((t) => [
          ...t,
          {
            id: `${d.id}-failed-${Date.now()}`,
            variant: "error",
            title: "Falha na ingestão",
            message: d.error ? `"${d.title}": ${d.error}` : `"${d.title}" não pôde ser processado.`,
          },
        ]);
      }
    }

    prevRef.current = next;
  }, [docs]);

  return { toasts, dismissToast };
}
