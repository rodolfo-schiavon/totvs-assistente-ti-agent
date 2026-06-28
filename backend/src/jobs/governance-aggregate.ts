import { prisma } from "../db";
import { evaluateGovernanceAlerts } from "../services/governance-alerts";
import type { GovernancePeriod } from "../services/governance-period";
import { periodToSince } from "../services/governance-period";
import { applyUsageBaseline } from "../services/usage-baseline";

const MANUAL_MINUTES_SAVED = Number(process.env.GOV_MANUAL_MINUTES_PER_DOC || "15");
const HOURLY_RATE_BRL = Number(process.env.GOV_HOURLY_RATE_BRL || "150");

async function refreshMaterializedView() {
  try {
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_governance_daily;`);
  } catch {
    try {
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW mv_governance_daily;`);
    } catch (e) {
      console.warn("mv refresh skipped:", e);
    }
  }
}

async function rollupCostMetrics(since: Date) {
  const rows = await prisma.llmObservability.findMany({
    where: { createdAt: { gte: since } },
    select: {
      userId: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      estimatedCostUsd: true,
      createdAt: true,
      user: { select: { role: true } },
    },
  });

  const buckets = new Map<
    string,
    {
      metricDate: Date;
      metricKey: string;
      userId?: string;
      userRole?: string;
      model?: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      costUsd: number;
      turnCount: number;
    }
  >();

  for (const row of rows) {
    const day = new Date(row.createdAt);
    day.setHours(0, 0, 0, 0);
    const keys = [
      { key: `global:${day.toISOString().slice(0, 10)}`, userId: undefined, userRole: undefined, model: undefined },
      row.userId
        ? {
            key: `user:${row.userId}:${day.toISOString().slice(0, 10)}`,
            userId: row.userId,
            userRole: row.user?.role,
            model: undefined,
          }
        : null,
      row.model
        ? {
            key: `model:${row.model}:${day.toISOString().slice(0, 10)}`,
            userId: undefined,
            userRole: undefined,
            model: row.model,
          }
        : null,
    ].filter(Boolean) as {
      key: string;
      userId?: string;
      userRole?: string;
      model?: string;
    }[];

    for (const k of keys) {
      const existing = buckets.get(k.key) ?? {
        metricDate: day,
        metricKey: k.key,
        userId: k.userId,
        userRole: k.userRole,
        model: k.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        turnCount: 0,
      };
      existing.inputTokens += row.inputTokens;
      existing.outputTokens += row.outputTokens;
      existing.totalTokens += row.totalTokens;
      existing.costUsd += row.estimatedCostUsd;
      existing.turnCount += 1;
      buckets.set(k.key, existing);
    }
  }

  for (const b of buckets.values()) {
    await prisma.llmCostMetric.upsert({
      where: {
        metricDate_metricKey: { metricDate: b.metricDate, metricKey: b.metricKey },
      },
      create: b,
      update: {
        inputTokens: b.inputTokens,
        outputTokens: b.outputTokens,
        totalTokens: b.totalTokens,
        costUsd: b.costUsd,
        turnCount: b.turnCount,
        userId: b.userId,
        userRole: b.userRole,
        model: b.model,
      },
    });
  }
}

async function snapshotExecutiveMetrics(period: GovernancePeriod) {
  const since = periodToSince(period);

  const [
    turns,
    tokensAgg,
    users,
    convs,
    prompts,
    ragQueries,
    avgLatency,
    errors,
    feedbackAvg,
    qualityAvg,
    securityEvents,
    hallucinations,
  ] = await Promise.all([
    prisma.llmObservability.count({ where: { createdAt: { gte: since } } }),
    prisma.llmObservability.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { totalTokens: true, estimatedCostUsd: true },
    }),
    prisma.llmObservability.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since }, userId: { not: null } },
    }),
    prisma.llmObservability.groupBy({
      by: ["conversationId"],
      where: { createdAt: { gte: since }, conversationId: { not: null } },
    }),
    prisma.promptAnalytics.count({ where: { createdAt: { gte: since } } }),
    prisma.ragMetrics.count({ where: { createdAt: { gte: since } } }),
    prisma.llmObservability.aggregate({
      where: { createdAt: { gte: since }, latencyMs: { not: null } },
      _avg: { latencyMs: true },
    }),
    prisma.llmObservability.count({ where: { createdAt: { gte: since }, status: "error" } }),
    prisma.llmFeedback.aggregate({
      where: { createdAt: { gte: since }, rating: { not: null } },
      _avg: { rating: true },
    }),
    prisma.promptQualityScore.aggregate({
      where: { createdAt: { gte: since } },
      _avg: { score: true },
    }),
    prisma.promptSecurityEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.hallucinationEvent.count({ where: { createdAt: { gte: since } } }),
  ]);

  const docsProcessed = await prisma.knowledgeDocument.count({
    where: { status: "ready", updatedAt: { gte: since } },
  });

  const successRate = turns > 0 ? (turns - errors) / turns : 1;
  const hoursSaved = (prompts * MANUAL_MINUTES_SAVED) / 60;
  const aiCost = tokensAgg._sum.estimatedCostUsd ?? 0;
  const roiBrl = hoursSaved * HOURLY_RATE_BRL - aiCost * 5.5;

  const metrics: Record<string, number | string | null> = {
    turns,
    totalTokens: tokensAgg._sum.totalTokens ?? 0,
    totalCostUsd: aiCost,
    activeUsers: users.length,
    activeConversations: convs.length,
    prompts,
    ragQueries,
    docsProcessed,
    avgLatencyMs: avgLatency._avg.latencyMs ?? 0,
    errorRate: turns > 0 ? errors / turns : 0,
    successRate,
    avgFeedback: feedbackAvg._avg.rating ?? null,
    avgQualityScore: qualityAvg._avg.score ?? null,
    securityEvents,
    hallucinationEvents: hallucinations,
    hoursSavedEstimate: Math.round(hoursSaved * 10) / 10,
    roiBrlEstimate: Math.round(roiBrl * 100) / 100,
  };

  for (const [metricKey, value] of Object.entries(metrics)) {
    await prisma.aiGovernanceMetric.upsert({
      where: { period_metricKey: { period, metricKey } },
      create: {
        period,
        metricKey,
        valueNumber: typeof value === "number" ? value : null,
        valueJson: typeof value === "string" ? JSON.stringify(value) : null,
      },
      update: {
        valueNumber: typeof value === "number" ? value : null,
        valueJson: typeof value === "string" ? JSON.stringify(value) : null,
        computedAt: new Date(),
      },
    });
  }
}

async function purgeOldEvents(retentionDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(7, retentionDays));

  await Promise.all([
    prisma.llmObservability.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.promptAnalytics.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.promptSecurityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.promptQualityScore.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.ragMetrics.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.hallucinationEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ]);
}

export async function runGovernanceAggregateJob(): Promise<void> {
  const settings = await prisma.workspaceSettings.findUnique({ where: { id: "default" } });
  const retentionDays = settings?.retentionDays ?? 90;

  const since = applyUsageBaseline(new Date());
  since.setDate(since.getDate() - 90);

  await rollupCostMetrics(since);
  for (const period of ["7d", "30d", "90d", "12m"] as GovernancePeriod[]) {
    await snapshotExecutiveMetrics(period);
  }
  await refreshMaterializedView();
  await purgeOldEvents(retentionDays);
  await evaluateGovernanceAlerts();
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startGovernanceAggregateScheduler() {
  if (intervalHandle) return;
  const run = () => {
    runGovernanceAggregateJob().catch((e) => console.error("governance aggregate:", e));
  };
  run();
  intervalHandle = setInterval(run, 5 * 60 * 1000);
}
