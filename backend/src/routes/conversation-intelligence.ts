import type { FastifyInstance } from "fastify";
import { canViewOwnConversationsOnly } from "../core/conversation-permissions";
import {
  canAnonymizeConversations,
  canAuditAllConversations,
  canDeleteConversations,
  canExportConversations,
} from "../core/conversation-permissions";
import { requireAuthenticatedUser } from "../middleware/auth";
import { rollupConversationMetrics } from "../jobs/conversation-metrics-rollup";
import { prisma } from "../db";
import { logConversationExport, logConversationView } from "../services/conversation-audit-log";
import { semanticSearch } from "../services/conversation-embeddings";
import { anonymizeConversation, softDeleteConversation } from "../services/conversation-lgpd";
import { parseListQuery } from "../services/conversation-intelligence-query";
import { maskSensitiveText } from "../services/conversation-risk";
import { periodToSince } from "../services/governance-period";
import { rowsToCsv, rowsToPdfBuffer, rowsToXlsxBuffer } from "../services/governance-export";
import { conversationExportFilename, formatConversationAsText } from "../services/conversation-text-export";
import { messagePlainText } from "../services/text-search";

function requireAuditAccess(request: { auth?: { jwt?: boolean; role?: string } }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  if (!request.auth?.jwt) {
    reply.code(401).send({ error: "Não autenticado." });
    return false;
  }
  if (!canAuditAllConversations(request.auth.role) && !canViewOwnConversationsOnly(request.auth.role)) {
    reply.code(403).send({ error: "Acesso restrito." });
    return false;
  }
  return true;
}

export async function conversationIntelligenceRoutes(app: FastifyInstance) {
  app.get("/api/v1/conversation-intelligence/overview", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    const period = (request.query as { period?: string }).period || "30d";
    const since = periodToSince(period);

    const [totalConvs, totalMsgs, today, week, month, activeUsers, daily] = await Promise.all([
      prisma.conversationMetrics.count({ where: { lastActivityAt: { gte: since }, status: "active" } }),
      prisma.conversationMetrics.aggregate({
        where: { lastActivityAt: { gte: since } },
        _sum: { messageCount: true, totalTokens: true, estimatedCostUsd: true },
        _avg: { durationMs: true, messageCount: true },
      }),
      prisma.conversationMetrics.count({
        where: { lastActivityAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      prisma.conversationMetrics.count({
        where: { lastActivityAt: { gte: periodToSince("7d") } },
      }),
      prisma.conversationMetrics.count({
        where: { lastActivityAt: { gte: periodToSince("30d") } },
      }),
      prisma.conversationMetrics.groupBy({
        by: ["userId"],
        where: { lastActivityAt: { gte: since } },
      }),
      prisma.$queryRaw<Array<{ day: Date; conversations: number; messages: number; tokens: number; cost_usd: number }>>`
        SELECT day, conversations, messages, tokens, cost_usd
        FROM mv_conversation_daily WHERE day >= ${since} ORDER BY day ASC
      `.catch(() => []),
    ]);

    const ragCount = await prisma.conversationMetrics.count({
      where: { lastActivityAt: { gte: since }, ragUsed: true },
    });
    const toolsCount = await prisma.conversationMetrics.count({
      where: { lastActivityAt: { gte: since }, toolsUsed: true },
    });
    const negFeedback = await prisma.conversationMetrics.count({
      where: { lastActivityAt: { gte: since }, negativeFeedback: true },
    });

    return {
      period,
      kpis: {
        totalConversations: totalConvs,
        totalMessages: totalMsgs._sum.messageCount ?? 0,
        conversationsToday: today,
        conversations7d: week,
        conversations30d: month,
        activeUsers: activeUsers.length,
        avgDurationMs: Math.round(totalMsgs._avg.durationMs ?? 0),
        messagesPerConversation: Number((totalMsgs._avg.messageCount ?? 0).toFixed(1)),
        totalTokens: totalMsgs._sum.totalTokens ?? 0,
        estimatedCostUsd: totalMsgs._sum.estimatedCostUsd ?? 0,
        withDocuments: await prisma.conversationMetrics.count({
          where: { lastActivityAt: { gte: since }, documentsUsed: { gt: 0 } },
        }),
        withRag: ragCount,
        withTools: toolsCount,
        negativeFeedback: negFeedback,
      },
      series: {
        daily: (daily as Array<{ day: Date; conversations: number; messages: number; tokens: number; cost_usd: number }>).map((d) => ({
          date: d.day,
          conversations: Number(d.conversations),
          messages: Number(d.messages),
          tokens: Number(d.tokens),
          costUsd: Number(d.cost_usd),
        })),
      },
    };
  });

  app.get("/api/v1/conversation-intelligence/conversations", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    const q = request.query as Record<string, string>;
    const { page, limit, skip, where, orderBy } = parseListQuery(q);

    if (canViewOwnConversationsOnly(request.auth!.role)) {
      where.userId = request.auth!.userId;
    }

    const [items, total] = await Promise.all([
      prisma.conversationMetrics.findMany({ where, orderBy, skip, take: limit }),
      prisma.conversationMetrics.count({ where }),
    ]);

    return {
      page,
      limit,
      total,
      items: items.map((i) => ({
        ...i,
        tenantLabel: "Organização",
        department: i.department || i.userRole,
      })),
    };
  });

  app.get("/api/v1/conversation-intelligence/conversations/:id", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    const { id } = request.params as { id: string };

    const conv = await prisma.agentConversation.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(canViewOwnConversationsOnly(request.auth!.role) ? { userId: request.auth!.userId } : {}),
      },
      include: {
        user: { select: { id: true, username: true, role: true, department: true } },
        messages: { orderBy: { createdAt: "asc" } },
        metrics: true,
        compliance: true,
      },
    });
    if (!conv) return reply.code(404).send({ error: "Conversa não encontrada" });

    await logConversationView(id, request.auth!.userId!, request.auth!.role).catch(() => undefined);

    const masked = conv.compliance?.masked ?? false;
    const [obs, rag, security, risks, feedback] = await Promise.all([
      prisma.llmObservability.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } }),
      prisma.ragMetrics.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } }),
      prisma.conversationSecurityEvent.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.conversationRiskAnalysis.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" } }),
      prisma.llmFeedback.findMany({ where: { conversationId: id } }),
    ]);

    return {
      conversation: {
        id: conv.id,
        title: conv.title,
        tenantId: conv.tenantId,
        tenantLabel: "Organização",
        user: conv.user,
        analysisType: conv.analysisType,
        clientIp: conv.clientIp,
        userAgent: conv.userAgent,
        channel: conv.channel,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        metrics: conv.metrics,
        compliance: conv.compliance,
      },
      timeline: conv.messages.map((m) => {
        let content: unknown = m.content;
        try {
          content = JSON.parse(m.content);
        } catch {
          /* raw */
        }
        if (masked && typeof content === "object" && content && "markdown" in (content as object)) {
          (content as { markdown: string }).markdown = maskSensitiveText(
            String((content as { markdown: string }).markdown)
          );
        } else if (masked && typeof content === "string") {
          content = maskSensitiveText(content);
        }
        return {
          id: m.id,
          role: m.role,
          content,
          usage: m.usageJson ? JSON.parse(m.usageJson) : undefined,
          createdAt: m.createdAt,
        };
      }),
      observability: obs,
      rag,
      security,
      risks,
      feedback,
    };
  });

  app.get("/api/v1/conversation-intelligence/conversations/:id/export", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    if (!canExportConversations(request.auth!.role)) {
      return reply.code(403).send({ error: "Sem permissão para exportar." });
    }
    const { id } = request.params as { id: string };

    const conv = await prisma.agentConversation.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(canViewOwnConversationsOnly(request.auth!.role) ? { userId: request.auth!.userId } : {}),
      },
      include: {
        user: { select: { username: true, role: true, department: true } },
        messages: { orderBy: { createdAt: "asc" } },
        metrics: true,
      },
    });
    if (!conv) return reply.code(404).send({ error: "Conversa não encontrada" });

    const text = formatConversationAsText({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      clientIp: conv.clientIp,
      userAgent: conv.userAgent,
      channel: conv.channel,
      user: conv.user,
      metrics: conv.metrics,
      messages: conv.messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });

    await logConversationExport(request.auth!.userId, "txt", "conversation", 1, { conversationId: id });

    reply.header("Content-Type", "text/plain; charset=utf-8");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${conversationExportFilename(conv.title, conv.id)}"`
    );
    return reply.send(text);
  });

  app.get("/api/v1/conversation-intelligence/conversations/:id/messages/:msgId/audit", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    const { id, msgId } = request.params as { id: string; msgId: string };

    const obs = await prisma.llmObservability.findFirst({
      where: { conversationId: id, messageId: msgId },
      orderBy: { createdAt: "desc" },
    });
    const rag = await prisma.ragMetrics.findFirst({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
    });
    const audit = await prisma.agentAuditLog.findFirst({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
    });

    return { observability: obs, rag, audit };
  });

  app.get("/api/v1/conversation-intelligence/search", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    const q = request.query as { q?: string; mode?: string; limit?: string };
    const query = (q.q || "").trim();
    if (query.length < 2) return { query, results: [] };

    const limit = Math.min(50, Number(q.limit || 30));
    const mode = q.mode || "hybrid";

    let results: Array<Record<string, unknown>> = [];

    if (mode === "semantic" || mode === "hybrid") {
      const semantic = await semanticSearch(query, limit);
      const convIds = [...new Set(semantic.map((s) => s.conversationId))];
      const metrics = await prisma.conversationMetrics.findMany({
        where: { conversationId: { in: convIds } },
        take: limit,
      });
      results = metrics.map((m) => ({
        ...m,
        matchType: "semantic",
        score: semantic.find((s) => s.conversationId === m.conversationId)?.score,
      }));
    }

    if ((mode === "fts" || mode === "hybrid") && results.length < limit) {
      const { where } = parseListQuery({ q: query, limit: String(limit) });
      if (canViewOwnConversationsOnly(request.auth!.role)) where.userId = request.auth!.userId;
      const fts = await prisma.conversationMetrics.findMany({ where, take: limit });
      for (const row of fts) {
        if (!results.find((r) => r.conversationId === row.conversationId)) {
          results.push({ ...row, matchType: "fts" });
        }
      }
    }

    await prisma.conversationSearchHistory.create({
      data: {
        actorUserId: request.auth!.userId,
        query,
        mode,
        resultCount: results.length,
      },
    });

    return { query, mode, results: results.slice(0, limit) };
  });

  app.post("/api/v1/conversation-intelligence/conversations/:id/view", async (request, reply) => {
    if (!requireAuthenticatedUser(request, reply)) return;
    const { id } = request.params as { id: string };
    await logConversationView(id, request.auth!.userId!, request.auth!.role);
    return { ok: true };
  });

  async function handleExport(
    request: { auth?: { userId?: string; role?: string; jwt?: boolean }; body?: unknown; query?: unknown },
    reply: { code: (n: number) => { send: (b: unknown) => unknown }; header: (k: string, v: string) => void; send: (b: unknown) => unknown }
  ) {
    if (!request.auth?.userId) return reply.code(401).send({ error: "Não autenticado." });
    if (!canExportConversations(request.auth.role)) {
      return reply.code(403).send({ error: "Sem permissão para exportar." });
    }

    const body = (request.body || {}) as { format?: string; filters?: Record<string, string> };
    const query = (request.query || {}) as { format?: string; period?: string };
    const format = body.format || query.format || "csv";
    const filters = body.filters || { period: query.period || "30d" };
    const { where } = parseListQuery(filters);
    const rows = await prisma.conversationMetrics.findMany({ where, take: 5000 });

    await logConversationExport(request.auth.userId, format, "conversations", rows.length, filters);

    if (format === "json") return { rows };
    if (format === "xlsx") {
      const buf = rowsToXlsxBuffer(rows as unknown as Record<string, unknown>[]);
      reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return reply.send(buf);
    }
    if (format === "pdf") {
      const buf = await rowsToPdfBuffer("Auditoria de Conversas", rows as unknown as Record<string, unknown>[]);
      reply.header("Content-Type", "application/pdf");
      return reply.send(buf);
    }
    const csv = rowsToCsv(rows as unknown as Record<string, unknown>[]);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    return reply.send(csv);
  }

  app.get("/api/v1/conversation-intelligence/export", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    return handleExport(request, reply);
  });

  app.post("/api/v1/conversation-intelligence/export", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    return handleExport(request, reply);
  });

  app.post("/api/v1/conversation-intelligence/conversations/:id/anonymize", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    if (!canAnonymizeConversations(request.auth!.role)) {
      return reply.code(403).send({ error: "Sem permissão." });
    }
    const { id } = request.params as { id: string };
    await anonymizeConversation(id, request.auth!.userId!);
    return { ok: true };
  });

  app.delete("/api/v1/conversation-intelligence/conversations/:id", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    if (!canDeleteConversations(request.auth!.role)) {
      return reply.code(403).send({ error: "Sem permissão." });
    }
    const { id } = request.params as { id: string };
    await softDeleteConversation(id, request.auth!.userId!);
    return { ok: true };
  });

  app.get("/api/v1/conversation-intelligence/usage", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    const since = periodToSince((request.query as { period?: string }).period || "30d");
    const [byUser, byDept, byModel] = await Promise.all([
      prisma.conversationMetrics.groupBy({
        by: ["userId"],
        where: { lastActivityAt: { gte: since } },
        _count: { _all: true },
        _sum: { totalTokens: true, estimatedCostUsd: true },
        orderBy: { _sum: { totalTokens: "desc" } },
        take: 10,
      }),
      prisma.conversationMetrics.groupBy({
        by: ["department"],
        where: { lastActivityAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.conversationMetrics.groupBy({
        by: ["primaryModel"],
        where: { lastActivityAt: { gte: since } },
        _count: { _all: true },
        _sum: { totalTokens: true },
        orderBy: { _sum: { totalTokens: "desc" } },
        take: 10,
      }),
    ]);
    return { byUser, byDepartment: byDept, byModel };
  });

  app.get("/api/v1/conversation-intelligence/productivity", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    const period = (request.query as { period?: string }).period || "30d";
    const metrics = await prisma.aiGovernanceMetric.findMany({ where: { period } });
    const map = Object.fromEntries(metrics.map((m) => [m.metricKey, m.valueNumber]));
    return {
      period,
      hoursSavedEstimate: map.hoursSavedEstimate ?? 0,
      roiBrlEstimate: map.roiBrlEstimate ?? 0,
      disclaimer: "Estimativa configurável (GOV_MANUAL_MINUTES_PER_DOC / GOV_HOURLY_RATE_BRL)",
    };
  });

  app.get("/api/v1/conversation-intelligence/security", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    const since = periodToSince((request.query as { period?: string }).period || "30d");
    const [events, bySeverity, risks] = await Promise.all([
      prisma.conversationSecurityEvent.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.conversationSecurityEvent.groupBy({
        by: ["severity"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.conversationRiskAnalysis.groupBy({
        by: ["riskType"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    return { events, bySeverity, risks };
  });

  app.get("/api/v1/conversation-intelligence/compliance", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    const [settings, views, exports, audits, compliance] = await Promise.all([
      prisma.workspaceSettings.findUnique({ where: { id: "default" } }),
      prisma.conversationView.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.conversationExport.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.conversationAudit.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.conversationCompliance.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
    ]);
    return { retentionDays: settings?.retentionDays ?? 90, views, exports, audits, compliance };
  });

  app.post("/api/v1/conversation-intelligence/admin/rollup", async (request, reply) => {
    if (!requireAuditAccess(request, reply)) return;
    await rollupConversationMetrics();
    return { ok: true };
  });
}
