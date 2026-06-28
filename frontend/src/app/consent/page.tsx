"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ConsentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function accept() {
    if (!accepted) {
      setError("Marque a caixa para confirmar que leu e aceita os termos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/consent/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissNotice: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível registrar o consentimento.");
      }
      router.replace("/dashboard/executive");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold">Aviso sobre uso da IA</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Antes de utilizar o assistente jurídico, leia atentamente:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--color-foreground-muted)]">
          <li>Este sistema é um assistente interno e <strong>não substitui advogados</strong>.</li>
          <li>Toda saída da IA deve ser revisada por profissional responsável.</li>
          <li>A IA pode cometer erros — valide leis, prazos e obrigações antes de utilizar.</li>
          <li>Documentos confidenciais serão processados por provedores de IA configurados (BYOK).</li>
          <li>Não insira dados desnecessários ou não autorizados para análise.</li>
          <li>O uso é auditado (login, conversas, uploads e geração de respostas).</li>
        </ul>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-border)] p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            Li e aceito os termos de uso da IA e declaro ciência dos riscos.{" "}
            <strong>Não exibir este aviso novamente.</strong>
          </span>
        </label>
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        <Button onClick={accept} disabled={loading || !accepted} className="w-full">
          {loading ? "Registrando…" : "Continuar para o sistema"}
        </Button>
      </Card>
    </div>
  );
}
