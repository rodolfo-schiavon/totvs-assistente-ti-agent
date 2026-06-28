"use client";

type ChartSpec = {
  type: string;
  title: string;
  subtitle?: string;
  data: {
    name?: string;
    value?: number;
    label?: string;
    category?: string;
    count?: number;
    opened?: number;
    closed?: number;
    period?: string;
  }[];
};

function rowLabel(d: ChartSpec["data"][number]): string {
  return d.name || d.label || d.category || d.period || "—";
}

function rowValue(d: ChartSpec["data"][number]): string {
  if (typeof d.value === "number") return String(d.value);
  if (typeof d.count === "number") return String(d.count);
  if (typeof d.opened === "number" || typeof d.closed === "number") {
    return `${d.opened ?? 0} / ${d.closed ?? 0}`;
  }
  return "—";
}

export function AgentChartBlock({ chart }: { chart: ChartSpec }) {
  if (!chart.data?.length) return null;

  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-sm font-medium text-[var(--color-foreground)]">{chart.title}</p>
      {chart.subtitle ? (
        <p className="mb-3 text-xs text-[var(--color-muted)]">{chart.subtitle}</p>
      ) : (
        <div className="mb-3" />
      )}
      <table className="w-full text-xs">
        <tbody>
          {chart.data.map((d, i) => (
            <tr key={i} className="border-t border-[var(--color-border)]/50">
              <td className="py-1.5 pr-2 text-[var(--color-muted)]">{rowLabel(d)}</td>
              <td className="py-1.5 text-right tabular-nums text-[var(--color-foreground)]">
                {rowValue(d)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
