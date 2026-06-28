"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard/executive";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Credenciais inválidas.");
        return;
      }
      const data = await res.json();
      if (data.mustChangePassword || data.passwordExpired) {
        router.push("/change-password");
      } else if (!data.aiNoticeDismissed) {
        router.push("/consent");
      } else {
        router.push(next);
      }
      router.refresh();
    } catch {
      setError("Falha ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass-card w-full max-w-sm rounded-xl p-6">
      <h1 className="text-lg font-semibold text-[var(--color-foreground)]">Assistente de TI</h1>
      <p className="mt-1 text-xs text-[var(--color-muted)]">Acesso ao escritório</p>

      <label className="mt-6 block text-xs text-[var(--color-muted)]">Usuário</label>
      <input
        type="text"
        autoComplete="username"
        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      <label className="mt-4 block text-xs text-[var(--color-muted)]">Senha</label>
      <input
        type="password"
        autoComplete="current-password"
        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error ? <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p> : null}

      <Button type="submit" className="mt-6 w-full" disabled={loading}>
        {loading ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <Suspense fallback={<div className="text-sm text-[var(--color-muted)]">Carregando…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
