import { prisma } from "../db";
import { applyUsageBaseline } from "./usage-baseline";

const HOURLY_ERROR_RATE_THRESHOLD = Number(process.env.GOV_ALERT_ERROR_RATE || "0.15");
const DAILY_COST_THRESHOLD = Number(process.env.GOV_ALERT_DAILY_COST_USD || "25");
const DAILY_TOKENS_THRESHOLD = Number(process.env.GOV_ALERT_DAILY_TOKENS || "500000");
const FEEDBACK_AVG_THRESHOLD = Number(process.env.GOV_ALERT_FEEDBACK_AVG || "2.5");
const RAG_SUCCESS_THRESHOLD = Number(process.env.GOV_ALERT_RAG_SUCCESS || "0.6");
const MONTHLY_BUDGET = Number(process.env.GOV_ALERT_MONTHLY_BUDGET_USD || "500");

async function upsertOpenAlert(
  alertType: string,
  title: string,
  description: string,
  severity: "baixa" | "media" | "alta" | "critica",
  metadata?: Record<string, unknown>
) {
  const existing = await prisma.llmAlert.findFirst({
    where: { alertType, status: { in: ["open", "ack"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return;

  await prisma.llmAlert.create({
    data: {
      alertType,
      title,
      description,
      severity,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

export async function evaluateGovernanceAlerts(): Promise<void> {
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const sinceDay = applyUsageBaseline(dayStart);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const sinceMonth = applyUsageBaseline(monthStart);

  const [hourTurns, hourErrors, dayAgg, monthCost, injectionCount, feedbackAgg, ragAgg] =
    await Promise.all([
      prisma.llmObservability.count({ where: { createdAt: { gte: sinceHour } } }),
      prisma.llmObservability.count({
        where: { createdAt: { gte: sinceHour }, status: "error" },
      }),
      prisma.llmObservability.aggregate({
        where: { createdAt: { gte: sinceDay } },
        _sum: { totalTokens: true, estimatedCostUsd: true },
      }),
      prisma.llmObservability.aggregate({
        where: { createdAt: { gte: sinceMonth } },
        _sum: { estimatedCostUsd: true },
      }),
      prisma.promptSecurityEvent.count({
        where: {
          createdAt: { gte: sinceDay },
          severity: { in: ["alta", "critica"] },
        },
      }),
      prisma.llmFeedback.aggregate({
        where: { createdAt: { gte: sinceDay }, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      prisma.ragMetrics.groupBy({
        by: ["success"],
        where: { createdAt: { gte: sinceDay } },
        _count: { _all: true },
      }),
    ]);

  if (hourTurns > 0) {
    const errorRate = hourErrors / hourTurns;
    if (errorRate >= HOURLY_ERROR_RATE_THRESHOLD) {
      await upsertOpenAlert(
        "error_rate",
        "Taxa de erro elevada",
        `Taxa de erro ${(errorRate * 100).toFixed(1)}% na última hora.`,
        errorRate >= 0.3 ? "alta" : "media",
        { errorRate, hourTurns, hourErrors }
      );
    }
  }

  const dayCost = dayAgg._sum.estimatedCostUsd ?? 0;
  const dayTokens = dayAgg._sum.totalTokens ?? 0;
  if (dayCost >= DAILY_COST_THRESHOLD) {
    await upsertOpenAlert(
      "daily_cost",
      "Consumo diário elevado",
      `Custo estimado hoje: US$ ${dayCost.toFixed(2)}.`,
      dayCost >= DAILY_COST_THRESHOLD * 2 ? "alta" : "media",
      { dayCost }
    );
  }
  if (dayTokens >= DAILY_TOKENS_THRESHOLD) {
    await upsertOpenAlert(
      "daily_tokens",
      "Volume de tokens elevado",
      `${dayTokens.toLocaleString("pt-BR")} tokens consumidos hoje.`,
      "media",
      { dayTokens }
    );
  }

  const monthCostVal = monthCost._sum.estimatedCostUsd ?? 0;
  const dayOfMonth = sinceDay.getDate();
  const projected = dayOfMonth > 0 ? (monthCostVal / dayOfMonth) * 30 : monthCostVal;
  if (projected >= MONTHLY_BUDGET) {
    await upsertOpenAlert(
      "monthly_budget",
      "Projeção mensal acima do orçamento",
      `Projeção: US$ ${projected.toFixed(2)} (orçamento US$ ${MONTHLY_BUDGET}).`,
      "alta",
      { projected, monthCostVal }
    );
  }

  if (injectionCount > 0) {
    await upsertOpenAlert(
      "prompt_injection",
      "Tentativa de prompt injection detectada",
      `${injectionCount} evento(s) de severidade alta/crítica hoje.`,
      "critica",
      { injectionCount }
    );
  }

  if ((feedbackAgg._count.rating ?? 0) >= 3) {
    const avg = feedbackAgg._avg.rating ?? 5;
    if (avg < FEEDBACK_AVG_THRESHOLD) {
      await upsertOpenAlert(
        "feedback_quality",
        "Queda na satisfação dos usuários",
        `Média de feedback: ${avg.toFixed(1)}/5.`,
        "media",
        { avg }
      );
    }
  }

  const ragTotal = ragAgg.reduce((a, r) => a + r._count._all, 0);
  const ragOk = ragAgg.find((r) => r.success)?._count._all ?? 0;
  if (ragTotal >= 5) {
    const rate = ragOk / ragTotal;
    if (rate < RAG_SUCCESS_THRESHOLD) {
      await upsertOpenAlert(
        "rag_failure",
        "Taxa de sucesso RAG baixa",
        `Sucesso RAG: ${(rate * 100).toFixed(0)}% hoje.`,
        "media",
        { rate, ragTotal }
      );
    }
  }
}

export async function countOpenAlerts(): Promise<number> {
  return prisma.llmAlert.count({ where: { status: "open" } });
}
