import type { RiskLevel } from "@prisma/client";
import { prisma } from "../db";
import { parseUsageJson } from "../services/usage-reports";
import { getTokenUsageBaselineAt } from "../services/usage-baseline";
import { messagePlainText } from "../services/text-search";
import { analyzeTextRisk, maxRiskLevel } from "../services/conversation-risk";
import { backfillEmbeddings } from "../services/conversation-embeddings";

function levelRank(l: RiskLevel): number {
  const m: Record<RiskLevel, number> = { baixo: 1, medio: 2, alto: 3, critico: 4 };
  return m[l] ?? 1;
}

export async function rollupConversationMetrics(): Promise<void> {
  const convs = await prisma.agentConversation.findMany({
    where: { deletedAt: null },
    include: {
      user: { select: { id: true, role: true, department: true } },
      messages: { orderBy: { createdAt: "asc" } },
      compliance: true,
    },
    take: 500,
    orderBy: { updatedAt: "desc" },
  });

  for (const conv of convs) {
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let cost = 0;
    let primaryModel: string | undefined;
    const searchParts: string[] = [conv.title || ""];
    let durationMs: number | null = null;

    if (conv.messages.length >= 2) {
      const first = conv.messages[0]?.createdAt;
      const last = conv.messages[conv.messages.length - 1]?.createdAt;
      if (first && last) durationMs = last.getTime() - first.getTime();
    }

    const usageBaseline = getTokenUsageBaselineAt();

    for (const m of conv.messages) {
      searchParts.push(messagePlainText(m.content));
      if (usageBaseline && m.createdAt < usageBaseline) continue;
      const u = parseUsageJson(m.usageJson);
      if (u) {
        inputTokens += u.inputTokens;
        outputTokens += u.outputTokens;
        totalTokens += u.totalTokens;
        cost += u.estimatedCostUsd;
        primaryModel = u.model || primaryModel;
      }
    }

    const [obs, rag, feedback, risks, security] = await Promise.all([
      prisma.llmObservability.findMany({
        where: { conversationId: conv.id },
        select: { toolsJson: true, route: true, model: true },
      }),
      prisma.ragMetrics.findFirst({
        where: { conversationId: conv.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.llmFeedback.findMany({ where: { conversationId: conv.id } }),
      prisma.conversationRiskAnalysis.findMany({ where: { conversationId: conv.id } }),
      prisma.promptSecurityEvent.count({ where: { conversationId: conv.id } }),
    ]);

    const toolsUsed = obs.some((o) => o.toolsJson && o.toolsJson !== "[]");
    const ragUsed = Boolean(rag) || obs.some((o) => (o.route || "").toLowerCase().includes("document"));
    const documentsUsed = rag?.docsRetrieved ?? 0;
    const avgFeedback =
      feedback.filter((f) => f.rating != null).length > 0
        ? feedback.reduce((a, f) => a + (f.rating || 0), 0) / feedback.filter((f) => f.rating != null).length
        : null;
    const negativeFeedback = feedback.some((f) => f.thumbs === "down" || (f.rating != null && f.rating <= 2));

    let riskLevel: RiskLevel = "baixo";
    for (const r of risks) {
      if (levelRank(r.riskLevel) > levelRank(riskLevel)) riskLevel = r.riskLevel;
    }
    if (security > 0 && levelRank("alto") > levelRank(riskLevel)) riskLevel = "alto";

    const status = conv.compliance?.anonymized
      ? "anonymized"
      : conv.compliance?.deletedAt || conv.deletedAt
        ? "deleted"
        : "active";

    await prisma.conversationMetrics.upsert({
      where: { conversationId: conv.id },
      create: {
        conversationId: conv.id,
        tenantId: conv.tenantId,
        userId: conv.userId,
        title: conv.title,
        department: conv.user.department || conv.user.role,
        userRole: conv.user.role,
        messageCount: conv.messages.length,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: cost,
        primaryModel: primaryModel || obs[0]?.model,
        ragUsed,
        toolsUsed,
        documentsUsed,
        negativeFeedback,
        avgFeedbackRating: avgFeedback,
        riskLevel,
        durationMs: durationMs ?? undefined,
        status,
        searchText: searchParts.join("\n").slice(0, 50000),
        lastActivityAt: conv.updatedAt,
      },
      update: {
        title: conv.title,
        department: conv.user.department || conv.user.role,
        userRole: conv.user.role,
        messageCount: conv.messages.length,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: cost,
        primaryModel: primaryModel || obs[0]?.model,
        ragUsed,
        toolsUsed,
        documentsUsed,
        negativeFeedback,
        avgFeedbackRating: avgFeedback,
        riskLevel,
        durationMs: durationMs ?? undefined,
        status,
        searchText: searchParts.join("\n").slice(0, 50000),
        lastActivityAt: conv.updatedAt,
      },
    });
  }

  try {
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_conversation_daily;`);
  } catch {
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW mv_conversation_daily;`).catch(() => undefined);
  }

  await backfillEmbeddings(25);
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startConversationIntelligenceScheduler() {
  if (intervalHandle) return;
  const run = () => rollupConversationMetrics().catch((e) => console.error("conversation metrics:", e));
  run();
  intervalHandle = setInterval(run, 5 * 60 * 1000);
}
