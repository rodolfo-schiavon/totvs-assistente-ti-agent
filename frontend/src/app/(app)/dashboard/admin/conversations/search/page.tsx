"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ConversationShell } from "@/components/conversation-intelligence/ConversationShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function SearchInner() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("hybrid");
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (query.trim().length < 2) return;
    setLoading(true);
    const r = await fetch(
      `/api/conversation-intelligence/search?q=${encodeURIComponent(query)}&mode=${mode}`
    );
    const data = await r.json();
    setResults(data.results || []);
    setLoading(false);
  }

  return (
    <>
      <Header title="Auditoria de Conversas" />
      <main className="p-4 md:p-6">
        <ConversationShell title="Busca Global">
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[240px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
              placeholder="Pergunta, resposta, título, ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <select
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="hybrid">Híbrida (FTS + semântica)</option>
              <option value="fts">Texto completo</option>
              <option value="semantic">Semântica</option>
            </select>
            <Button onClick={search} disabled={loading}>
              {loading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {results.map((r) => (
              <Card
                key={String(r.conversationId)}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/dashboard/admin/conversations/${r.conversationId}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/dashboard/admin/conversations/${r.conversationId}`);
                  }
                }}
                className="cursor-pointer p-3 transition-colors hover:bg-[var(--color-card-hover)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              >
                <p className="font-medium">{String(r.title || "Sem título")}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {String(r.department)} · {String(r.matchType || "match")}
                </p>
              </Card>
            ))}
          </div>
        </ConversationShell>
      </main>
    </>
  );
}

export default function ConversationsSearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
