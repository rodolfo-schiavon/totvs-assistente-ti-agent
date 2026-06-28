"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LEGAL_ROLES, ROLE_LABELS, type LegalRole } from "@/lib/roles";
import { Pencil, Trash2, X, Check, KeyRound } from "lucide-react";

type User = {
  id: string;
  username: string;
  role: string;
  active: boolean;
  mustChangePassword?: boolean;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<LegalRole>("advogado");
  const [msg, setMsg] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<LegalRole>("advogado");
  const [editActive, setEditActive] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [usersRes, meRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/auth/me"),
    ]);
    const data = await usersRes.json();
    setUsers(data.users || []);
    if (meRes.ok) {
      const me = await meRes.json();
      setCurrentUserId(me.userId ?? me.id ?? null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setTempPassword(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, role }),
    });
    const d = await res.json();
    if (res.ok) {
      setMsg(`Usuário criado. Senha temporária gerada — copie agora (não será exibida novamente).`);
      setTempPassword(d.temporaryPassword || null);
      setUsername("");
      load();
    } else {
      setMsg(d.error || "Erro");
    }
    setBusy(false);
  }

  function startEdit(u: User) {
    setEditingId(u.id);
    setEditRole(u.role as LegalRole);
    setEditActive(u.active);
    setMsg("");
    setTempPassword(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: editRole, active: editActive }),
    });
    if (res.ok) {
      setMsg("Usuário atualizado.");
      setEditingId(null);
      load();
    } else {
      const d = await res.json();
      setMsg(d.error || "Erro ao atualizar");
    }
    setBusy(false);
  }

  async function resetPassword(id: string, name: string) {
    if (!confirm(`Gerar nova senha temporária para "${name}"? O usuário precisará alterá-la no próximo login.`)) {
      return;
    }
    setBusy(true);
    setMsg("");
    setTempPassword(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    });
    const d = await res.json();
    if (res.ok) {
      setTempPassword(d.temporaryPassword || null);
      setMsg(`Nova senha temporária para ${name}:`);
      load();
    } else {
      setMsg(d.error || "Erro");
    }
    setBusy(false);
  }

  async function removeUser(id: string, name: string) {
    if (!confirm(`Excluir o usuário "${name}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMsg("Usuário excluído.");
      load();
    } else {
      const d = await res.json();
      setMsg(d.error || "Erro ao excluir");
    }
    setBusy(false);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold">Usuários</h1>

      <form onSubmit={create} className="glass-card space-y-3 rounded-xl p-4">
        <h2 className="text-sm font-medium text-[var(--color-foreground-muted)]">Novo usuário</h2>
        <p className="text-xs text-[var(--color-muted)]">
          Uma senha temporária forte será gerada automaticamente. O usuário deverá defini-la no primeiro login.
        </p>
        <input
          className="w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          placeholder="Usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <select
          className="w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as LegalRole)}
        >
          {LEGAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={busy}>
          Criar usuário
        </Button>
      </form>

      {tempPassword ? (
        <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-4">
          <p className="text-xs text-[var(--color-muted)]">Senha temporária (copie agora):</p>
          <code className="mt-1 block break-all text-sm font-mono text-[var(--color-accent-glow)]">
            {tempPassword}
          </code>
        </div>
      ) : null}

      {msg ? <p className="text-xs text-[var(--color-muted)]">{msg}</p> : null}

      <div className="glass-card overflow-hidden rounded-xl">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-medium">Usuários cadastrados ({users.length})</h2>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {users.map((u) => (
            <li key={u.id} className="px-4 py-3">
              {editingId === u.id ? (
                <div className="space-y-3">
                  <p className="font-medium">{u.username}</p>
                  <select
                    className="w-full rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as LegalRole)}
                  >
                    {LEGAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                      disabled={u.id === currentUserId}
                    />
                    Ativo
                    {u.id === currentUserId ? (
                      <span className="text-xs text-[var(--color-muted)]">(você)</span>
                    ) : null}
                  </label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => saveEdit(u.id)} disabled={busy}>
                      <Check className="mr-1 h-3 w-3" /> Salvar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="mr-1 h-3 w-3" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {u.username}
                      {u.id === currentUserId ? (
                        <span className="ml-2 text-xs text-[var(--color-muted)]">(você)</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {ROLE_LABELS[u.role as LegalRole] || u.role}
                      {!u.active ? " · inativo" : ""}
                      {u.mustChangePassword ? " · senha temporária" : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      title="Nova senha temporária"
                      onClick={() => resetPassword(u.id, u.username)}
                      disabled={busy}
                    >
                      <KeyRound className="h-3 w-3" />
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(u)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {u.id !== currentUserId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                        onClick={() => removeUser(u.id, u.username)}
                        disabled={busy}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
