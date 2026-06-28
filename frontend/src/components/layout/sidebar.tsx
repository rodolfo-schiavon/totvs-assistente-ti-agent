"use client";

import {
  LayoutDashboard,
  Bot,
  Settings,
  Users,
  PanelLeftClose,
  PanelLeft,
  BookOpen,
  Scale,
  LogOut,
  Shield,
  MessageSquareText,
  KeyRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { canViewManagementReports, isAdmin } from "@/lib/roles";
import { useUiStore, sidebarWidthClass } from "@/store/ui-store";
import { NavLink } from "@/components/layout/nav-link";

const nav = [
  { href: "/dashboard/executive", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/agent", label: "Agente IA", icon: Bot },
];

const governanceNav = {
  href: "/dashboard/admin/governance/overview",
  label: "Governança de IA",
  icon: Shield,
  matchPrefix: "/dashboard/admin/governance",
};

const conversationsNav = {
  href: "/dashboard/admin/conversations/overview",
  label: "Auditoria de Conversas",
  icon: MessageSquareText,
  matchPrefix: "/dashboard/admin/conversations",
};

const knowledgeNav = {
  href: "/dashboard/admin/knowledge",
  label: "Base conhecimento",
  icon: BookOpen,
  matchPrefix: "/dashboard/admin/knowledge",
};

const adminNav = [
  { href: "/dashboard/admin/llm", label: "LLM", icon: Settings },
  { href: "/dashboard/admin/users", label: "Usuários", icon: Users },
];

export function Sidebar() {
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUiStore();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRole(data?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const showGovernance = role && canViewManagementReports(role);
  const showAdmin = role && isAdmin(role);

  return (
    <aside
      className={cn(
        "pointer-events-auto fixed bottom-0 left-0 right-0 z-50 flex h-16 flex-row border-t border-[var(--color-border)] bg-[var(--color-background)]/98 backdrop-blur-xl transition-[width] duration-200 md:bottom-auto md:top-0 md:h-screen md:flex-col md:border-r md:border-t-0",
        sidebarWidthClass(sidebarCollapsed)
      )}
    >
      <div
        className={cn(
          "hidden items-center border-b border-[var(--color-border)] md:flex",
          sidebarCollapsed ? "justify-center px-2 py-4" : "gap-3 px-5 py-5"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
          <Scale className="h-5 w-5 text-[var(--color-accent-glow)]" />
        </div>
        {!sidebarCollapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-[var(--color-foreground)]">
              Assistente de TI
            </p>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
              Assistente jurídico
            </p>
          </div>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-row items-center justify-around gap-1 overflow-y-auto p-2 md:flex-col md:items-stretch md:justify-start md:space-y-1 md:p-2 md:pt-3">
        {nav.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} collapsed={sidebarCollapsed} />
        ))}

        {showGovernance ? (
          <>
            <NavLink
              href={knowledgeNav.href}
              label={knowledgeNav.label}
              icon={knowledgeNav.icon}
              matchPrefix={knowledgeNav.matchPrefix}
              collapsed={sidebarCollapsed}
            />
            <NavLink
              href={governanceNav.href}
              label={governanceNav.label}
              icon={governanceNav.icon}
              matchPrefix={governanceNav.matchPrefix}
              collapsed={sidebarCollapsed}
            />
            <NavLink
              href={conversationsNav.href}
              label={conversationsNav.label}
              icon={conversationsNav.icon}
              matchPrefix={conversationsNav.matchPrefix}
              collapsed={sidebarCollapsed}
            />
          </>
        ) : null}

        {showAdmin
          ? adminNav.map(({ href, label, icon }) => (
              <NavLink key={href} href={href} label={label} icon={icon} collapsed={sidebarCollapsed} />
            ))
          : null}
      </nav>

      <div className="hidden space-y-1 border-t border-[var(--color-border)] p-2 md:block">
        <NavLink
          href="/account/password"
          label="Minha senha"
          icon={KeyRound}
          collapsed={sidebarCollapsed}
        />
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--color-foreground-muted)] transition-all hover:bg-[var(--color-card-hover)] hover:text-[var(--color-foreground)]",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!sidebarCollapsed ? <span>Recolher</span> : null}
        </button>
        <button
          type="button"
          onClick={logout}
          title="Sair"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--color-foreground-muted)] transition-all hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!sidebarCollapsed ? <span>Sair</span> : null}
        </button>
      </div>
    </aside>
  );
}
