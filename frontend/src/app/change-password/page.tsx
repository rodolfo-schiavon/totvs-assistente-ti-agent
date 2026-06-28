"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const POLICY_HINT =
  "Mínimo 12 caracteres, com maiúscula, minúscula, número e caractere especial.";

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [requiresCurrent, setRequiresCurrent] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.mustChangePassword) setRequiresCurrent(false);
        if (d?.passwordExpired) setRequiresCurrent(true);
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("A confirmação não confere.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: requiresCurrent ? currentPassword : undefined,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Não foi possível alterar a senha.");
        return;
      }
      const status = await fetch("/api/auth/session-status").then((r) => r.json());
      if (!status.aiNoticeDismissed) {
        router.replace("/consent");
      } else {
        router.replace("/dashboard/executive");
      }
      router.refresh();
    } catch {
      setError("Falha ao alterar senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Alterar senha</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {expired
            ? "Sua senha expirou (política de 45 dias). Defina uma nova senha forte."
            : requiresCurrent
              ? "Por segurança, defina uma nova senha forte."
              : "Senha temporária detectada. Defina sua senha definitiva para continuar."}
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        {requiresCurrent ? (
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
        ) : null}
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </Card>
  );
}

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <ChangePasswordForm />
      </Suspense>
    </div>
  );
}
