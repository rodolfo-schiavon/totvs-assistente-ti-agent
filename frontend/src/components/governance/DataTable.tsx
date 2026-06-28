"use client";

import type { ReactNode } from "react";

export function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | ReactNode>[];
}) {
  if (!rows.length) {
    return <p className="text-sm text-[var(--color-muted)]">Nenhum registro.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--color-card)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium text-[var(--color-muted)]">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[var(--color-border)]">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 text-[var(--color-foreground)]">
                  {row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
