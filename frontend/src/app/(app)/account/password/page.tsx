"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const POLICY_HINT =
  "Mínimo 12 caracteres, com maiúscula, minúscula, número e caractere especial.";

export default function AccountPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (newPassword !== confirm) {
      setError("A confirmação não confere.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erro ao alterar senha.");
        return;
      }
      setMsg("Senha alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setError("Falha ao alterar senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header title="Minha senha" />
      <main className="mx-auto max-w-md p-4 md:p-6">
        <Card className="space-y-4 p-6">
          <p className="text-sm text-[var(--color-muted)]">
            Por política de segurança, as senhas expiram a cada 45 dias.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-[var(--color-muted)]">Senha atual</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-muted)]">Nova senha</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={12}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-muted)]">Confirmar nova senha</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={12}
                required
              />
            </div>
            <p className="text-xs text-[var(--color-muted)]">{POLICY_HINT}</p>
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            {msg ? <p className="text-sm text-[var(--color-accent-glow)]">{msg}</p> : null}
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando…" : "Alterar senha"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
