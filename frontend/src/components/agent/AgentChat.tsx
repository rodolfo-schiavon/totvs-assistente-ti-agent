"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AgentConversationList } from "./AgentConversationList";
import { AgentChatLayout } from "./AgentChatLayout";
import { AgentMessageList } from "./AgentMessageList";
import { AgentComposer } from "./AgentComposer";
import {
  useAgentMessages,
  aggregateSessionUsage,
  type AgentMessageItem,
  type MessageAttachment,
} from "@/hooks/use-agent-messages";
import type { TokenUsage } from "@/lib/token-usage";
import { useUiStore } from "@/store/ui-store";

const ANALYSIS_TYPES = [
  { id: "geral", label: "Consulta geral" },
  { id: "revisao_juridica", label: "Revisão jurídica" },
  { id: "analise_riscos", label: "Análise de riscos" },
  { id: "criacao_contrato", label: "Criação de contrato" },
  { id: "resumo_executivo", label: "Resumo executivo" },
  { id: "minuta", label: "Minuta preliminar" },
];

const SUGGESTIONS = [
  "Revise as cláusulas de confidencialidade deste contrato",
  "Quais riscos jurídicos você identifica neste documento?",
  "Resuma as obrigações das partes",
  "Consultar modelos na base de conhecimento",
];

const ATTACHMENT_POLL_MS = 2000;
const ATTACHMENT_POLL_MAX_MS = 5 * 60 * 1000;

async function waitForAttachmentReady(
  id: string
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const started = Date.now();
  while (Date.now() - started < ATTACHMENT_POLL_MAX_MS) {
    const res = await fetch(`/api/agent/attachments/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || "Falha ao consultar extração do anexo." };
    }
    const status = data.extractionStatus as string | undefined;
    if (status === "ready") return { ok: true, data };
    if (status === "failed") {
      return { ok: false, error: data.extractionError || "Não foi possível extrair o conteúdo do arquivo." };
    }
    await new Promise((r) => setTimeout(r, ATTACHMENT_POLL_MS));
  }
  return {
    ok: false,
    error: "A extração do anexo demorou demais. Tente um PDF menor ou envie pela Base de conhecimento.",
  };
}

export function AgentChat() {
  const {
    messages,
    reset,
    load,
    addUser,
    addAssistantPlaceholder,
    streamToken,
    confirmUser,
    confirmAssistant,
    fail,
    remove,
  } = useAgentMessages();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("Nova conversa");
  const [sessionUsage, setSessionUsage] = useState<TokenUsage | null>(null);
  const [sessionTurns, setSessionTurns] = useState(0);
  const [error, setError] = useState("");
  const [listRefresh, setListRefresh] = useState(0);
  const [knowledgeMode, setKnowledgeMode] = useState(true);
  const [analysisType, setAnalysisType] = useState("geral");

  const scrollRef = useRef<HTMLDivElement>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadSeqRef = useRef(0);
  const sendAbortRef = useRef<AbortController | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    (MessageAttachment & { localPreview?: string; extractionStatus?: string })[]
  >([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const appSidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);

  const scrollToBottom = useCallback((smooth = false) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    resizeObsRef.current?.disconnect();
    resizeObsRef.current = new ResizeObserver(() => scrollToBottom(false));
    resizeObsRef.current.observe(el);
    return () => resizeObsRef.current?.disconnect();
  }, [scrollToBottom]);

  function resetSession() {
    loadAbortRef.current?.abort();
    sendAbortRef.current?.abort();
    reset();
    setConversationId(null);
    setConversationTitle("Nova conversa");
    setSessionUsage(null);
    setSessionTurns(0);
    setError("");
    setInput("");
    setLoading(false);
  }

  async function loadConversation(id: string) {
    if (loadingConv) return;
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    const seq = ++loadSeqRef.current;

    setLoadingConv(true);
    setError("");
    try {
      const res = await fetch(`/api/agent/conversations/${id}`, { signal: ac.signal });
      const data = await res.json();
      if (seq !== loadSeqRef.current) return;
      if (!res.ok) {
        setError(data.error || "Erro ao carregar conversa");
        return;
      }
      setConversationId(data.id);
      setConversationTitle(data.title || "Conversa");
      const msgs: AgentMessageItem[] = (data.messages || []).map(
        (m: { id: string; role: string; content: unknown; usage?: TokenUsage; createdAt: string }) => ({
          clientId: m.id,
          serverId: m.id,
          role: m.role as "user" | "assistant",
          content: m.content as string | Record<string, unknown>,
          usage: m.usage,
          status: "done" as const,
          createdAt: m.createdAt,
        })
      );
      load(msgs);
      const turns = msgs.filter((m) => m.role === "assistant").length;
      setSessionTurns(turns);
      setSessionUsage(aggregateSessionUsage(msgs));
    } catch (e) {
      if ((e as Error).name !== "AbortError" && seq === loadSeqRef.current) {
        setError("Falha ao carregar histórico.");
      }
    } finally {
      if (seq === loadSeqRef.current) setLoadingConv(false);
    }
  }

  async function renameConversation(title: string) {
    if (!conversationId) return;
    const res = await fetch(`/api/agent/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setConversationTitle(title);
      setListRefresh((k) => k + 1);
    }
  }

  async function uploadAttachment(file: File) {
    setUploadingAttachment(true);
    setError("");
    const localPreview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    const fd = new FormData();
    fd.append("file", file);
    if (conversationId) fd.append("conversationId", conversationId);
    try {
      const res = await fetch("/api/agent/attachments", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha ao enviar anexo.");
        return;
      }

      const ready = await waitForAttachmentReady(data.id as string);
      if (!ready.ok) {
        setError(ready.error);
        return;
      }

      const finalData = ready.data;
      setPendingAttachments((p) => [
        ...p,
        {
          id: finalData.id as string,
          fileName: finalData.fileName as string,
          mimeType: finalData.mimeType as string,
          previewUrl: (finalData.previewUrl as string | undefined) || localPreview,
          localPreview,
          extractionStatus: finalData.extractionStatus as string | undefined,
        },
      ]);
    } catch {
      setError("Falha ao enviar anexo.");
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function sendMessage(text: string, retryUserClientId?: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (retryUserClientId) remove(retryUserClientId);

    setInput("");
    setError("");
    setLoading(true);

    const userClientId = crypto.randomUUID();
    const assistantClientId = crypto.randomUUID();
    const attachmentIds = pendingAttachments.map((a) => a.id);
    const attachmentMeta: MessageAttachment[] = pendingAttachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      previewUrl: a.previewUrl || a.localPreview,
    }));
    const attachNote =
      pendingAttachments.length > 0
        ? `\n\n[Anexos: ${pendingAttachments.map((a) => a.fileName).join(", ")}]`
        : "";
    addUser(userClientId, trimmed + attachNote, attachmentMeta);
    setPendingAttachments([]);
    addAssistantPlaceholder(assistantClientId);

    sendAbortRef.current?.abort();
    const ac = new AbortController();
    sendAbortRef.current = ac;

    try {
      const res = await fetch("/api/agent/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId,
          knowledgeMode,
          analysisType,
          attachmentIds,
          sessionInputTokens: sessionUsage?.input_tokens ?? 0,
          sessionOutputTokens: sessionUsage?.output_tokens ?? 0,
          sessionCostUsd: sessionUsage?.estimated_cost_usd ?? 0,
          sessionTurns,
        }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        fail(userClientId, data.error || "Erro ao enviar mensagem");
        remove(assistantClientId);
        if (data.conversation_id) setConversationId(data.conversation_id);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotDone = false;
      let gotError = false;
      let streamedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload) as {
              type: string;
              token?: string;
              conversation_id?: string;
              user_message_id?: string;
              assistant_message_id?: string;
              response?: Record<string, unknown>;
              usage?: TokenUsage;
              session_usage?: TokenUsage;
              error?: string;
            };

            if (evt.type === "meta") {
              if (evt.conversation_id) setConversationId(evt.conversation_id);
              if (evt.user_message_id) confirmUser(userClientId, evt.user_message_id);
            } else if (evt.type === "token" && evt.token) {
              streamedContent += evt.token;
              streamToken(assistantClientId, evt.token);
            } else if (evt.type === "done") {
              gotDone = true;
              if (evt.conversation_id) setConversationId(evt.conversation_id);
              if (evt.user_message_id) confirmUser(userClientId, evt.user_message_id);
              const finalContent =
                evt.response && typeof evt.response === "object"
                  ? evt.response
                  : { type: "mixed_response", markdown: String(evt.response || ""), charts: [], kpis: [] };
              confirmAssistant(assistantClientId, finalContent, {
                serverId: evt.assistant_message_id,
                usage: evt.usage,
              });
              if (evt.session_usage) setSessionUsage(evt.session_usage);
              setSessionTurns((t) => t + 1);
              if (evt.response && typeof evt.response === "object" && "title" in evt.response) {
                /* noop */
              }
              setListRefresh((k) => k + 1);
            } else if (evt.type === "error") {
              gotError = true;
              fail(userClientId, evt.error || "Erro no agente");
              remove(assistantClientId);
            }
          } catch {
            /* ignore malformed SSE */
          }
        }
      }

      if (!gotDone && !gotError) {
        if (streamedContent.trim()) {
          confirmAssistant(
            assistantClientId,
            { type: "mixed_response", markdown: streamedContent.trim(), charts: [], kpis: [] },
            {}
          );
          setError("A resposta foi interrompida antes de concluir. Revise o texto acima ou tente novamente.");
        } else {
          fail(userClientId, "O agente não concluiu a resposta a tempo. Tente novamente.");
          remove(assistantClientId);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        remove(assistantClientId);
      } else {
        fail(userClientId, "Falha de conexão com o agente.");
        remove(assistantClientId);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleRetry(clientId: string, text: string) {
    remove(clientId);
    const failedAssistant = messages.find(
      (m, i) => messages[i - 1]?.clientId === clientId && m.status === "failed"
    );
    if (failedAssistant) remove(failedAssistant.clientId);
    sendMessage(text);
  }

  const showEmpty = messages.length === 0 && !loadingConv;

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full flex-col overflow-hidden md:h-screen md:flex-row">
      <AgentConversationList
        activeId={conversationId}
        onSelect={loadConversation}
        onNew={resetSession}
        refreshKey={listRefresh}
        collapsed={historyCollapsed}
        onToggleCollapsed={() => setHistoryCollapsed((v) => !v)}
        wide={appSidebarCollapsed}
      />

      <AgentChatLayout
        title={conversationTitle}
        subtitle={
          conversationId ? "Thread ativa · memória persistente" : "Nova análise · contexto isolado"
        }
        sessionUsage={sessionUsage}
        sessionTurns={sessionTurns}
        onRename={conversationId ? renameConversation : undefined}
        knowledgeMode={knowledgeMode}
        onKnowledgeModeChange={setKnowledgeMode}
        composer={
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.docx,.txt,.md,.odt,image/*"
              onChange={(e) => {
                const files = e.target.files;
                if (files) Array.from(files).forEach(uploadAttachment);
                e.target.value = "";
              }}
            />
            {uploadingAttachment ? (
              <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Extraindo conteúdo do anexo… PDFs com imagens podem levar alguns minutos.
              </div>
            ) : null}
            {pendingAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] px-4 py-2">
                {pendingAttachments.map((a) =>
                  a.mimeType.startsWith("image/") && (a.previewUrl || a.localPreview) ? (
                    <img
                      key={a.id}
                      src={a.previewUrl || a.localPreview}
                      alt={a.fileName}
                      className="h-14 w-14 rounded-lg border border-[var(--color-border)] object-cover"
                    />
                  ) : (
                    <span
                      key={a.id}
                      className="rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-xs text-[var(--color-accent-glow)]"
                    >
                      {a.fileName}
                    </span>
                  )
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-4 py-2">
              <label className="text-xs text-[var(--color-muted)]" htmlFor="analysis-type">
                Tipo de análise
              </label>
              <select
                id="analysis-type"
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                disabled={loading || loadingConv}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
              >
                {ANALYSIS_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <AgentComposer
              input={input}
              onInputChange={setInput}
              onSubmit={() => sendMessage(input)}
              onStop={() => sendAbortRef.current?.abort()}
              loading={loading}
              disabled={loadingConv || uploadingAttachment}
              showAttach
              onAttach={() => !uploadingAttachment && fileInputRef.current?.click()}
            />
          </>
        }
      >
        <div ref={scrollRef} className="h-full overflow-y-auto px-4 md:px-5 lg:px-6">
          {loadingConv ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando conversa…
            </div>
          ) : showEmpty ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center py-16">
              <p className="mb-1 text-lg font-medium">Como posso ajudar?</p>
              <p className="mb-8 max-w-md text-center text-sm text-[var(--color-muted)]">
                Análises jurídicas assistidas por IA com consulta à base de documentos do escritório.
              </p>
              <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (s.includes("documentos")) setKnowledgeMode(true);
                      sendMessage(s);
                    }}
                    disabled={loading}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-3 text-left text-xs text-[var(--color-foreground-muted)] transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-card-hover)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AgentMessageList
              messages={messages}
              conversationId={conversationId}
              onRetry={handleRetry}
              onFollowUpSelect={(text) => sendMessage(text)}
            />
          )}
          {error ? <p className="py-2 text-center text-xs text-[var(--color-danger)]">{error}</p> : null}
        </div>
      </AgentChatLayout>
    </div>
  );
}
