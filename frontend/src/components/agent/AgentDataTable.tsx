"use client";

export function AgentDataTable({ tables }: { tables?: Record<string, unknown>[] }) {
  if (!tables?.length) return null;
  const table = tables[0];
  const headers = (table.headers as string[]) || [];
  const rows = (table.rows as string[][]) || [];
  if (!headers.length || !rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-background)]/60">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium text-[var(--color-muted)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i} className="border-t border-[var(--color-border)]/60">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-[var(--color-foreground)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
