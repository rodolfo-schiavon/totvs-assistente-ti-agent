"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { GovernanceShell } from "@/components/governance/GovernanceShell";
import { SeverityBadge } from "@/components/governance/SeverityBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function AlertsInner() {
  const params = useSearchParams();
  const period = params.get("period") || "30d";
  const [data, setData] = useState<{ openCount?: number; items?: Array<Record<string, unknown>> } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/governance/alerts?period=${period}`);
    setData(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [period]);

  async function patch(id: string, status: string) {
    await fetch(`/api/governance/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <>
      <Header title="Governança de IA" />
      <main className="p-4 md:p-6">
        <GovernanceShell title="Central de Alertas" section="alerts">
          {loading || !data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-4">
              <Card className="p-4 text-sm">Alertas abertos: {data.openCount ?? 0}</Card>
              {(data.items || []).map((a) => (
                <Card key={String(a.id)} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <SeverityBadge value={String(a.severity)} />
                        <span className="text-xs uppercase text-[var(--color-muted)]">{String(a.status)}</span>
                      </div>
                      <h3 className="mt-1 font-medium">{String(a.title)}</h3>
                      <p className="text-sm text-[var(--color-muted)]">{String(a.description ?? "")}</p>
                    </div>
                    <div className="flex gap-2">
                      {a.status === "open" ? (
                        <Button size="sm" variant="outline" onClick={() => patch(String(a.id), "ack")}>
                          Reconhecer
                        </Button>
                      ) : null}
                      {a.status !== "resolved" ? (
                        <Button size="sm" onClick={() => patch(String(a.id), "resolved")}>
                          Resolver
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </GovernanceShell>
      </main>
    </>
  );
}

export default function GovernanceAlertsPage() {
  return (
    <Suspense>
      <AlertsInner />
    </Suspense>
  );
}
