import { CHART } from "@/lib/charts/theme";

/** Encurta rótulos longos nos eixos */
export function truncateAxisLabel(value: unknown, maxLen = 24): string {
  const s = String(value ?? "").trim();
  if (!s || s === "—") return "—";
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

/** Largura da margem esquerda para barras horizontais (rótulos de categoria, técnico, etc.) */
export function leftMarginForNames(names: string[], min = 100, max = 280): number {
  const longest = names.reduce((m, n) => Math.max(m, String(n).length), 0);
  return Math.min(max, Math.max(min, 12 + longest * 7));
}

export const AXIS_TICK_FILL = CHART.axis;
