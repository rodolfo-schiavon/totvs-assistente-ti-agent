"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ConversationShell } from "@/components/conversation-intelligence/ConversationShell";
import {
  ConversationDataGrid,
  type ConversationRow,
} from "@/components/conversation-intelligence/ConversationDataGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

function ListInner() {
  const params = useSearchParams();
  const period = params.get("period") || "30d";
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/conversation-intelligence/conversations?period=${period}&limit=100`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((d) => setRows(d.items || []))
      .catch((e) => setError(e.message || "Erro"))
      .finally(() => setLoading(false));
  }, [period]);

  function exportData(format: string) {
    window.open(`/api/conversation-intelligence/export?format=${format}&period=${period}`, "_blank");
  }

  return (
    <>
      <Header title="Auditoria de Conversas" />
      <main className="p-4 md:p-6">
        <ConversationShell title="Listagem de Conversas" onExport={exportData}>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <Card className="p-4 text-sm text-[var(--color-danger)]">{error}</Card>
          ) : (
            <ConversationDataGrid rows={rows} />
          )}
        </ConversationShell>
      </main>
    </>
  );
}

export default function ConversationsListPage() {
  return (
    <Suspense>
      <ListInner />
    </Suspense>
  );
}
