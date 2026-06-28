"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PERIODS = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "12m", label: "12 meses" },
];

export const GOVERNANCE_NAV = [
  { href: "/dashboard/admin/governance/overview", label: "Visão Geral" },
  { href: "/dashboard/admin/governance/quality", label: "Qualidade" },
  { href: "/dashboard/admin/governance/observability", label: "Observabilidade" },
  { href: "/dashboard/admin/governance/costs", label: "Custos" },
  { href: "/dashboard/admin/governance/security", label: "Segurança" },
  { href: "/dashboard/admin/governance/compliance", label: "Compliance" },
  { href: "/dashboard/admin/governance/usage", label: "Analytics de Uso" },
  { href: "/dashboard/admin/governance/prompts", label: "Analytics de Prompts" },
  { href: "/dashboard/admin/governance/rag", label: "Analytics de RAG" },
  { href: "/dashboard/admin/governance/models", label: "Analytics de Modelos" },
  { href: "/dashboard/admin/governance/feedback", label: "Feedback" },
  { href: "/dashboard/admin/governance/alerts", label: "Alertas" },
];

export function GovernanceShell({
  title,
  section,
  children,
}: {
  title: string;
  section: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const period = params.get("period") || "30d";

  function setPeriod(p: string) {
    const next = new URLSearchParams(params.toString());
    next.set("period", p);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function exportData(format: string) {
    window.open(`/api/governance/export?format=${format}&section=${section}&period=${period}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-muted)]">Governança de IA</p>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                period === p.id
                  ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-glow)]"
                  : "bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              )}
            >
              {p.label}
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={() => exportData("csv")}>
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData("xlsx")}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData("pdf")}>
            PDF
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3">
        {GOVERNANCE_NAV.map((item) => (
          <Link
            key={item.href}
            href={`${item.href}?period=${period}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs transition-colors",
              pathname === item.href
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent-glow)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-foreground)]"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
