"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

type Props = {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed?: boolean;
  /** Marca ativo em sub-rotas (ex.: /dashboard/admin/governance/*) */
  matchPrefix?: string;
};

export function NavLink({ href, label, icon: Icon, collapsed, matchPrefix }: Props) {
  const pathname = usePathname();
  const setPendingNavigation = useUiStore((s) => s.setPendingNavigation);
  const pendingNavigation = useUiStore((s) => s.pendingNavigation);
  const active = matchPrefix ? pathname.startsWith(matchPrefix) : pathname === href;
  const isTargetPending = pendingNavigation === href;

  return (
    <Link
      href={href}
      prefetch
      title={collapsed ? label : undefined}
      onClick={() => {
        if (pathname !== href) setPendingNavigation(href);
      }}
      className={cn(
        "relative flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all md:justify-start",
        collapsed && "md:justify-center md:px-0",
        active
          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent-glow)]"
          : "text-[var(--color-foreground-muted)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-foreground)]",
        isTargetPending && !active && "opacity-80"
      )}
    >
      {isTargetPending && !active ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span className={cn("hidden md:inline", collapsed && "md:hidden")}>{label}</span>
    </Link>
  );
}
