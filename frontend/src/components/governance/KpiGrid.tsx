"use client";

import { Card } from "@/components/ui/card";

export function KpiGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <p className="text-xs text-[var(--color-muted)]">{item.label}</p>
          <p className="mt-1 text-xl font-semibold text-[var(--color-foreground)]">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
