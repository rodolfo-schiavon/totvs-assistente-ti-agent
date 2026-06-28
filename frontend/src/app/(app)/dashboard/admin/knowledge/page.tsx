"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToastStack } from "@/components/ui/toast-stack";
import { useKbStatusNotifications } from "@/hooks/use-kb-notifications";
import { Upload, Trash2, RefreshCw, Loader2, FileText, Search, X } from "lucide-react";

type Doc = {
  id: string;
  title: string;
  mimeType: string;
  byteSize: number;
  status: string;
  vfsSyncStatus?: string;
  vfsSyncError?: string;
  error?: string;
  preview?: string;
  snippet?: string;
  matchField?: string;
  createdAt: string;
};

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

export default function AdminKnowledgePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toasts, dismissToast } = useKbStatusNotifications(docs);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/knowledge/documents");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDocs(data.documents || []);
        setLoadError(null);
      } else {
        setLoadError(data.error || `Não foi possível carregar a base (${res.status}).`);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setIsSearchMode(false);
      await load(true);
      return;
    }
    setSearching(true);
    setIsSearchMode(true);
    try {
      const res = await fetch(`/api/admin/knowledge/documents/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (res.ok) setDocs(data.documents || []);
    } finally {
      setSearching(false);
    }
  }, [load]);

  useEffect(() => {
    load(false);
    const t = setInterval(() => {
      if (!isSearchMode) load(true);
    }, 8000);
    return () => clearInterval(t);
  }, [load, isSearchMode]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => runSearch(searchQuery), 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, runSearch]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch("/api/admin/knowledge/documents", { method: "POST", body: fd });
      }
      setSearchQuery("");
      setIsSearchMode(false);
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/knowledge/documents/${id}`, { method: "DELETE" });
    if (isSearchMode) await runSearch(searchQuery);
    else await load();
  }

  async function reindex(id: string) {
    await fetch(`/api/admin/knowledge/documents/${id}/reindex`, { method: "POST" });
    if (isSearchMode) await runSearch(searchQuery);
    else await load();
  }

  async function syncVfs() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/knowledge/sync-vfs", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMsg(data.error || "Falha ao sincronizar VFS");
      } else {
        const total = data.counts?.counts?.total ?? data.counts?.total;
        const files = data.counts?.counts?.vfs_keys?.length ?? data.counts?.vfs_keys?.length;
        const healed = data.healed ?? 0;
        setSyncMsg(
          typeof total === "number"
            ? `Sync concluído: ${healed} recuperado(s), ${total} doc(s) no backend, ${files ?? "?"} arquivo(s) no VFS.`
            : healed > 0
              ? `${healed} documento(s) recuperado(s) do cache DB. Sync VFS solicitado.`
              : "Sync VFS solicitado com sucesso."
        );
      }
      if (isSearchMode) await runSearch(searchQuery);
      else await load();
    } finally {
      setSyncing(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setIsSearchMode(false);
    load(true);
  }

  const displayDocs = docs;
  const q = searchQuery.trim();

  return (
    <div className="space-y-6">
      <ToastStack items={toasts} onDismiss={dismissToast} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Base de conhecimento</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Documentos indexados no VFS RAG 3.0 (/legal-kb/). Status <strong>synced</strong> = agente pode ler.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={syncing} onClick={syncVfs}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sincronizar VFS
        </Button>
      </div>
      {syncMsg ? <p className="text-sm text-[var(--color-muted)]">{syncMsg}</p> : null}
      {loadError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600">
          {loadError}
        </p>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar no título ou conteúdo dos documentos…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 pl-10 pr-10 text-sm"
          aria-label="Buscar documentos"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isSearchMode && q.length >= 2 ? (
        <p className="text-xs text-[var(--color-muted)]">
          {searching ? "Buscando…" : `${displayDocs.length} resultado(s) para "${q}"`}
        </p>
      ) : null}

      <div
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] p-8"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          uploadFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mb-2 h-8 w-8 text-[var(--color-muted)]" />
        <p className="mb-3 text-sm text-[var(--color-muted)]">
          PDF (extração via OpenAI), DOCX, TXT, MD, CSV, XLSX
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <Button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Enviar documentos
        </Button>
      </div>

      {loading && !isSearchMode ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-muted)]" />
        </div>
      ) : displayDocs.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-muted)]">
          {isSearchMode ? "Nenhum documento encontrado para esta busca." : "Nenhum documento na base."}
        </p>
      ) : (
        <ul className="space-y-2">
          {displayDocs.map((d) => (
            <li
              key={d.id}
              className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-muted)]" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {isSearchMode && q.length >= 2 ? (
                    <Highlight text={d.title} query={q} />
                  ) : (
                    d.title
                  )}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {(d.byteSize / 1024).toFixed(1)} KB ·{" "}
                  <span
                    className={
                      d.status === "ready"
                        ? "text-emerald-600"
                        : d.status === "failed"
                          ? "text-red-600"
                          : d.status === "processing"
                            ? "text-amber-600"
                            : ""
                    }
                  >
                    ingestão: {d.status}
                  </span>
                  {d.vfsSyncStatus ? (
                    <span
                      className={
                        d.vfsSyncStatus === "synced"
                          ? " text-emerald-600"
                          : d.vfsSyncStatus === "error"
                            ? " text-red-600"
                            : " text-amber-600"
                      }
                    >
                      {" "}
                      · VFS: {d.vfsSyncStatus}
                    </span>
                  ) : null}
                  {d.status === "ready" && d.vfsSyncStatus === "pending" ? (
                    <span className=" text-amber-600"> — clique Sincronizar VFS</span>
                  ) : null}
                  {d.error ? ` · ${d.error}` : ""}
                  {d.vfsSyncError ? ` · ${d.vfsSyncError}` : ""}
                </p>
                {d.snippet && isSearchMode ? (
                  <p className="mt-1 line-clamp-3 text-xs text-[var(--color-foreground-muted)]">
                    <Highlight text={d.snippet} query={q} />
                  </p>
                ) : d.preview ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-foreground-muted)]">{d.preview}</p>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => reindex(d.id)} title="Reindexar">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => remove(d.id)} title="Excluir">
                  <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
