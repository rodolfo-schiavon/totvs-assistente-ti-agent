"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { PasswordExpiryBanner } from "@/components/layout/PasswordExpiryBanner";
import { NavigationOverlay } from "@/components/layout/navigation-overlay";
import { useUiStore, mainPadClass } from "@/store/ui-store";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const isAgentChat = pathname === "/dashboard/agent";

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main
        className={cn(
          "relative z-0 min-h-screen pl-0 transition-[padding] duration-200",
          isAgentChat ? "pb-0 md:pb-0" : "pb-28 md:pb-8",
          mainPadClass(sidebarCollapsed)
        )}
      >
        {!isAgentChat ? <PasswordExpiryBanner /> : null}
        <div
          className={cn(
            "relative",
            isAgentChat ? "h-full" : "mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8"
          )}
        >
          {!isAgentChat ? <NavigationOverlay /> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
