import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  /** Rota clicada enquanto a nova página carrega (evita conteúdo “fantasma” da rota anterior). */
  pendingNavigation: string | null;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setPendingNavigation: (href: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      pendingNavigation: null,
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setPendingNavigation: (href) => set({ pendingNavigation: href }),
    }),
    {
      name: "helpdesk-ui",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);

export function sidebarWidthClass(collapsed: boolean): string {
  return collapsed ? "md:w-[4.25rem]" : "md:w-56 lg:w-64";
}

export function mainPadClass(collapsed: boolean): string {
  return collapsed ? "md:pl-[4.25rem]" : "md:pl-56 lg:pl-64";
}
