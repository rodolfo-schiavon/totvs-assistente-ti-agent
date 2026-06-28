"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModelCatalog } from "@/components/admin/ModelCatalog";
import {
  type LlmProviderId,
  PROVIDER_SLOTS,
  findModel,
  formatUsdPer1M,
  tierLabel,
} from "@/lib/llm-models";

type LlmConfig = {
  id: string;
  provider: string;
  displayName: string;
  model: string;
  apiKeyMasked: string;
  active: boolean;
};

type ProviderForm = {
  model: string;
  apiKey: string;
};

function emptyForms(): Record<LlmProviderId, ProviderForm> {
  return {
    openai: { model: "gpt-4o-mini", apiKey: "" },
    anthropic: { model: "claude-sonnet-4-5-20250929", apiKey: "" },
  };
}

export default function AdminLlmPage() {
  const [configs, setConfigs] = useState<LlmConfig[]>([]);
  const [providerTab, setProviderTab] = useState<LlmProviderId>("openai");
  const [forms, setForms] = useState<Record<LlmProviderId, ProviderForm>>(emptyForms);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<LlmProviderId | null>(null);

  async function load() {
    const res = await fetch("/api/admin/llm-configs", { credentials: "include" });
    if (res.status === 401) {
      setMsg("Sessão expirada. Faça login novamente.");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Erro ao carregar configurações.");
      return;
    }
    const list: LlmConfig[] = data.configs || [];
    setConfigs(list);
    setForms((prev) => {
      const next = { ...prev };
      for (const slot of PROVIDER_SLOTS) {
        const saved = list.find((c) => c.provider === slot.id);
        if (saved) {
          next[slot.id] = {
            model: saved.model,
            apiKey: "",
          };
        }
      }
      return next;
    });
  }

  useEffect(() => {
    load();
  }, []);

  function configFor(provider: LlmProviderId) {
    return configs.find((c) => c.provider === provider);
  }

  function updateForm(provider: LlmProviderId, patch: Partial<ProviderForm>) {
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  }

  async function testConnection(provider: LlmProviderId) {
    setMsg("");
    const form = forms[provider];
    const saved = configFor(provider);
    const apiKey = form.apiKey.trim();

    if (!apiKey && !saved) {
      setMsg("Informe a API Key para testar.");
      return;
    }

    if (!apiKey && saved) {
      const savedRes = await fetch(`/api/admin/llm-configs/${saved.id}/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const savedData = await savedRes.json();
      if (savedRes.ok && savedData.ok) {
        setMsg(`Teste ${provider} OK: ${savedData.message}`);
      } else {
        setMsg(savedData.message || savedData.error || "Falha no teste de conexão.");
      }
      return;
    }

    const res = await fetch("/api/admin/llm-configs/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider, model: form.model, apiKey }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setMsg(`Teste ${provider} OK: ${data.message}`);
    } else {
      setMsg(data.message || data.error || "Falha no teste de conexão.");
    }
  }

  async function save(provider: LlmProviderId) {
    setBusy(provider);
    setMsg("");
    const slot = PROVIDER_SLOTS.find((s) => s.id === provider)!;
    const form = forms[provider];
    const saved = configFor(provider);
    if (!form.apiKey.trim() && !saved) {
      setMsg(`Informe a API Key da ${slot.label}.`);
      setBusy(null);
      return;
    }
    const body: Record<string, unknown> = {
      model: form.model,
      displayName: `${slot.label} — ${slot.role}`,
      active: true,
    };
    if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();

    const res = await fetch(`/api/admin/llm-configs/by-provider/${provider}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`${slot.label} salvo com sucesso.`);
      updateForm(provider, { apiKey: "" });
      await load();
    } else {
      setMsg(data.error || "Erro ao salvar");
    }
    setBusy(null);
  }

  const activeSlot = PROVIDER_SLOTS.find((s) => s.id === providerTab)!;
  const activeSaved = configFor(providerTab);
  const activeForm = forms[providerTab];
  const selectedModel = findModel(activeForm.model);
  const configured = Boolean(activeSaved?.active);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Configuração LLM</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Uma chave por provedor. OpenAI alimenta extração; Anthropic alimenta chat e análises.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROVIDER_SLOTS.map((slot) => {
          const saved = configFor(slot.id);
          const isActive = providerTab === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setProviderTab(slot.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--color-accent)] text-white"
                  : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <span>{slot.label}</span>
              {saved?.active ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                    isActive ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-400"
                  }`}
                  title="Chave cadastrada"
                >
                  Ativa
                </span>
              ) : (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                    isActive ? "bg-white/20 text-white/80" : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  Pendente
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section className="glass-card space-y-4 rounded-xl p-4">
        <div>
          <h2 className="font-medium">{activeSlot.label}</h2>
          <p className="text-xs text-[var(--color-muted)]">{activeSlot.role}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{activeSlot.description}</p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            {configured ? (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                <span className="text-emerald-400">Chave cadastrada</span>
                <span className="text-[var(--color-muted)]">· modelo {activeSaved?.model}</span>
              </>
            ) : (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                <span className="text-amber-400">Nenhuma chave cadastrada</span>
              </>
            )}
          </div>
        </div>

        <ModelCatalog
          provider={providerTab}
          selectedModelId={activeForm.model}
          onSelect={(m) => updateForm(providerTab, { model: m.id })}
        />

        <div>
          <label className="text-xs text-[var(--color-muted)]">Modelo</label>
          <input
            className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            value={activeForm.model}
            onChange={(e) => updateForm(providerTab, { model: e.target.value })}
            required
          />
        </div>

        {selectedModel ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/50 px-3 py-2 text-xs text-[var(--color-muted)]">
            <span className="font-medium text-[var(--color-foreground)]">{selectedModel.label}</span>
            {" · "}
            entrada {formatUsdPer1M(selectedModel.inputUsdPer1M)}/1M · saída{" "}
            {formatUsdPer1M(selectedModel.outputUsdPer1M)}/1M · {selectedModel.contextK}k contexto ·{" "}
            {tierLabel(selectedModel.tier)}
          </div>
        ) : null}

        <div>
          <label className="text-xs text-[var(--color-muted)]">
            API Key {activeSaved ? "(deixe vazio para manter a chave atual)" : ""}
          </label>
          <input
            type="password"
            className="mt-1 w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            placeholder={configured ? "••••••••  (chave já cadastrada)" : activeSlot.keyPlaceholder}
            value={activeForm.apiKey}
            onChange={(e) => updateForm(providerTab, { apiKey: e.target.value })}
            required={!activeSaved}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => testConnection(providerTab)}>
            Testar conexão
          </Button>
          <Button type="button" disabled={busy === providerTab} onClick={() => save(providerTab)}>
            {busy === providerTab ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </section>

      {msg ? <p className="text-xs text-[var(--color-muted)]">{msg}</p> : null}
    </div>
  );
}
