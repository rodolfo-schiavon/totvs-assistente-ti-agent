"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Plus, Trash2, Loader2, PanelLeftClose, PanelLeft, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  snippet?: string;
  matchField?: "title" | "message";
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function groupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday.getTime() - 86400000);
  const startWeek = new Date(startToday.getTime() - 7 * 86400000);
  if (d >= startToday) return "Hoje";
  if (d >= startYesterday) return "Ontem";
  if (d >= startWeek) return "Esta semana";
  return "Anterior";
}

function groupConversations(items: ConversationSummary[]): { label: string; items: ConversationSummary[] }[] {
  const map = new Map<string, ConversationSummary[]>();
  for (const c of items) {
    const label = groupLabel(c.updatedAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(c);
  }
  const order = ["Hoje", "Ontem", "Esta semana", "Anterior"];
  return order.filter((l) => map.has(l)).map((label) => ({ label, items: map.get(label)! }));
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || query.length < 2) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded bg-[var(--color-accent)]/25 px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function AgentConversationList({
  activeId,
  onSelect,
  onNew,
  refreshKey,
  collapsed,
  onToggleCollapsed,
  wide,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey: number;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  wide?: boolean;
}) {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/conversations");
      const data = await res.json();
      if (res.ok) setItems(data.conversations || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setIsSearchMode(false);
      await load();
      return;
    }
    setSearching(true);
    setIsSearchMode(true);
    try {
      const res = await fetch(`/api/agent/conversations/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (res.ok) setItems(data.conversations || []);
    } finally {
      setSearching(false);
    }
  }, [load]);

  useEffect(() => {
    if (!isSearchMode) load();
  }, [load, refreshKey, isSearchMode]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => runSearch(searchQuery), 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, runSearch]);

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(id);
    try {
      await fetch(`/api/agent/conversations/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) onNew();
    } finally {
      setDeleting(null);
    }
  }

  const groups = isSearchMode ? null : groupConversations(items);
  const q = searchQuery.trim();

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-background)]/80 py-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Expandir histórico"
          className="rounded-md p-2 text-[var(--color-foreground-muted)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-foreground)]"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNew}
          title="Nova conversa"
          className="mt-2 rounded-md p-2 text-[var(--color-foreground-muted)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-foreground)]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  function renderItem(c: ConversationSummary) {
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            "group flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
            activeId === c.id
              ? "bg-[var(--color-accent)]/15 text-[var(--color-accent-glow)]"
              : "text-[var(--color-foreground-muted)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-foreground)]"
          )}
        >
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-[13px] leading-snug">
              {isSearchMode && q.length >= 2 ? <Highlight text={c.title} query={q} /> : c.title}
            </span>
            {isSearchMode && c.snippet && c.matchField === "message" ? (
              <span className="mt-1 line-clamp-2 block text-[11px] opacity-70">
                <Highlight text={c.snippet} query={q} />
              </span>
            ) : null}
            <span className="mt-0.5 block text-[10px] opacity-60">
              {formatRelative(c.updatedAt)} · {c.messageCount} msgs
              {isSearchMode && c.matchField === "title" ? " · título" : ""}
              {isSearchMode && c.matchField === "message" ? " · mensagem" : ""}
            </span>
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => remove(c.id, e)}
            onKeyDown={(e) => {
              if (e.key === "Enter") remove(c.id, e as unknown as React.MouseEvent);
            }}
            className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
            title="Excluir conversa"
          >
            {deleting === c.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </span>
        </button>
      </li>
    );
  }

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-background)]/80",
        wide ? "md:w-60 lg:w-64" : "md:w-52 lg:w-56"
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Histórico</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            title="Nova conversa"
            className="rounded-md p-1.5 text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-foreground)]"
          >
            <Plus className="h-4 w-4" />
          </button>
          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              title="Recolher histórico"
              className="rounded-md p-1.5 text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-foreground)]"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-b border-[var(--color-border)] px-2 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversas…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1.5 pl-8 pr-7 text-xs"
            aria-label="Buscar conversas"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
              aria-label="Limpar busca"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
        {isSearchMode && q.length >= 2 ? (
          <p className="mt-1 px-1 text-[10px] text-[var(--color-muted)]">
            {searching ? "Buscando…" : `${items.length} resultado(s)`}
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading || searching ? (
          <div className="flex justify-center py-6 text-[var(--color-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-[var(--color-muted)]">
            {isSearchMode ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda. Inicie uma nova análise."}
          </p>
        ) : isSearchMode ? (
          <ul className="space-y-0.5">{items.map(renderItem)}</ul>
        ) : (
          groups!.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {group.label}
              </p>
              <ul className="space-y-0.5">{group.items.map(renderItem)}</ul>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
