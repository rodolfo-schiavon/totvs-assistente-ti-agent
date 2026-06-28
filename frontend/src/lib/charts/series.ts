export type ChartPoint = { name: string; value: number };

/** Normaliza payloads do agente/API para { name, value }. */
export function normalizeChartPoints(
  rows: { name?: string; label?: string; category?: string; value?: number; count?: number }[]
): ChartPoint[] {
  return rows
    .map((d) => ({
      name: String(d.name || d.label || d.category || "").trim(),
      value: Number(d.value ?? d.count ?? 0),
    }))
    .filter((d) => d.name && d.name !== "—" && d.value > 0);
}

export function sortChartPointsDesc(data: ChartPoint[]): ChartPoint[] {
  return [...data].sort((a, b) => b.value - a.value);
}

export function chartHeightForBars(count: number, layout: "horizontal" | "vertical"): number {
  if (layout === "horizontal") {
    return Math.min(520, Math.max(200, 72 + count * 44));
  }
  return Math.min(420, Math.max(260, 240 + Math.min(count, 12) * 8));
}

export function formatChartPercent(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}
