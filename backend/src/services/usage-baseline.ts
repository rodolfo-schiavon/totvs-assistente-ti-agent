/** Data a partir da qual métricas de tokens/custo passam a contar (somente se env definida). */
export function getTokenUsageBaselineAt(): Date | null {
  const raw = process.env.TOKEN_USAGE_BASELINE_AT?.trim();
  if (!raw) return null;

  // YYYY-MM-DD → meia-noite em America/Sao_Paulo (UTC-3)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T03:00:00.000Z`);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Garante que consultas de uso nunca incluam período anterior ao baseline. */
export function applyUsageBaseline(since: Date): Date {
  const baseline = getTokenUsageBaselineAt();
  if (!baseline) return since;
  return baseline > since ? baseline : since;
}

/** Remove rollups de custo anteriores ao baseline (idempotente no startup). */
export async function purgePreBaselineCostRollups(): Promise<number> {
  const baseline = getTokenUsageBaselineAt();
  if (!baseline) return 0;

  const { prisma } = await import("../db");
  const result = await prisma.llmCostMetric.deleteMany({
    where: { metricDate: { lt: baseline } },
  });
  return result.count;
}
