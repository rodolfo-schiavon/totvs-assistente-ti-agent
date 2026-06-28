"use client";

type Kpi = { label: string; value: string | number };

export function AgentKpiRow({ kpis, showDataSource }: { kpis: Kpi[]; showDataSource?: boolean }) {
  if (!kpis.length) return null;
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass-card rounded-lg px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{k.label}</p>
            <p className="text-lg font-semibold text-[var(--color-foreground)]">{k.value}</p>
          </div>
        ))}
      </div>
      {showDataSource ? (
        <p className="text-[10px] text-[var(--color-muted)]">Fonte: dados importados</p>
      ) : null}
    </div>
  );
}
