"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GovernanceShell } from "@/components/governance/GovernanceShell";

export function GovernanceFetchPage({
  title,
  section,
  endpoint,
  render,
}: {
  title: string;
  section: string;
  endpoint: string;
  render: (data: unknown, period: string) => React.ReactNode;
}) {
  const params = useSearchParams();
  const period = params.get("period") || "30d";
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${endpoint}?period=${period}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message || "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [endpoint, period]);

  return (
    <>
      <Header title="Governança de IA" />
      <main className="p-4 md:p-6">
        <GovernanceShell title={title} section={section}>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : error ? (
            <Card className="p-4 text-sm text-[var(--color-danger)]">{error}</Card>
          ) : (
            render(data, period)
          )}
        </GovernanceShell>
      </main>
    </>
  );
}
