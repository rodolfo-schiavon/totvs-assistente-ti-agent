import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { canViewManagementReports, normalizeRole } from "../core/roles";
import { requireAuthenticatedUser } from "../middleware/auth";
import { resolveDbUserId } from "../services/resolve-user";
import { buildUsageReport, buildUserUsageSummary } from "../services/usage-reports";

export async function legalRoutes(app: FastifyInstance) {
  app.get("/api/v1/legal/dashboard", async (request, reply) => {
    if (!requireAuthenticatedUser(request, reply)) return;

    const userId = await resolveDbUserId(request.auth);
    if (!userId) return reply.code(401).send({ error: "Não autorizado" });

    const role = normalizeRole(request.auth?.role);
    const managementView = canViewManagementReports(role);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    if (!managementView) {
      const [usage, userMessages, conversations] = await Promise.all([
        buildUserUsageSummary(userId, 30),
        prisma.agentMessage.count({
          where: { role: "user", conversation: { userId }, createdAt: { gte: monthStart } },
        }),
        prisma.agentConversation.count({ where: { userId } }),
      ]);

      return {
        scope: "personal" as const,
        role,
        conversations,
        userMessages,
        documents: null,
        pendingDocuments: null,
        avgLatencyMs: 0,
        topAnalysisTypes: [],
        tokenUsage: {
          periodDays: 30,
          totalTokens: usage.totalTokens,
          estimatedCostUsd: usage.estimatedCostUsd,
          assistantMessages: usage.assistantMessagesInPeriod,
        },
      };
    }

    const [conversations, messages, documents, pendingDocs, audits, usageReport, activeUsers] =
      await Promise.all([
        prisma.agentConversation.count(),
        prisma.agentMessage.count({ where: { role: "user" } }),
        prisma.knowledgeDocument.count(),
        prisma.knowledgeDocument.count({ where: { status: { not: "ready" } } }),
        prisma.agentAuditLog.findMany({
          where: { createdAt: { gte: monthStart } },
          select: { analysisType: true, latencyMs: true },
          take: 500,
        }),
        buildUsageReport(30),
        prisma.user.count({ where: { active: true } }),
      ]);

    const analysisCounts: Record<string, number> = {};
    let totalLatency = 0;
    for (const row of audits) {
      const key = row.analysisType || "geral";
      analysisCounts[key] = (analysisCounts[key] || 0) + 1;
      if (row.latencyMs) totalLatency += row.latencyMs;
    }

    const topAnalysis = Object.entries(analysisCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      scope: "organization" as const,
      role,
      conversations,
      userMessages: messages,
      documents,
      pendingDocuments: pendingDocs,
      avgLatencyMs: audits.length ? Math.round(totalLatency / audits.length) : 0,
      topAnalysisTypes: topAnalysis,
      activeUsers,
      tokenUsage: {
        periodDays: usageReport.periodDays,
        totalTokens: usageReport.summary.totalTokens,
        estimatedCostUsd: usageReport.summary.estimatedCostUsd,
        assistantMessages: usageReport.summary.assistantMessages,
        activeUsers: usageReport.summary.activeUsers,
      },
    };
  });
}
