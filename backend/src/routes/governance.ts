import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser, requireManagement } from "../middleware/auth";
import { countOpenAlerts } from "../services/governance-alerts";
import {
  fetchSectionRows,
  rowsToCsv,
  rowsToPdfBuffer,
  rowsToXlsxBuffer,
} from "../services/governance-export";
import { ingestGovernanceEvents, type IngestEvent } from "../services/governance-ingest";
import { parseDateRange, parsePagination, periodToSince } from "../services/governance-period";
import { buildUsageReport } from "../services/usage-reports";
import { prisma } from "../db";

const overviewCache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 60_000;

function getCachedOverview(period: string) {
  const hit = overviewCache.get(period);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  return null;
}

function setCachedOverview(period: string, data: unknown) {
  overviewCache.set(period, { at: Date.now(), data });
}

function periodToDays(period: string): number {
  switch (period) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "12m":
      return 365;
    default:
      return 30;
  }
}

export async function governanceRoutes(app: FastifyInstance) {
  app.get("/api/v1/governance/overview", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const period = (request.query as { period?: string }).period || "30d";
    const cached = getCachedOverview(period);
    if (cached) return cached;

    const since = periodToSince(period);
    const metrics = await prisma.aiGovernanceMetric.findMany({ where: { period } });
    const metricMap = Object.fromEntries(
      metrics.map((m) => [m.metricKey, m.valueNumber ?? m.valueJson])
    );

    const daily = await prisma.$queryRaw<
      Array<{ day: Date; turns: number; tokens: number; cost_usd: number; errors: number }>
    >`
      SELECT day, turns, tokens, cost_usd, errors
      FROM mv_governance_daily
      WHERE day >= ${since}
      ORDER BY day ASC
    `.catch(async () => {
      const rows = await prisma.llmObservability.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      });
      return rows.map((r) => ({
        day: r.createdAt,
        turns: r._count._all,
        tokens: 0,
        cost_usd: 0,
        errors: 0,
      }));
    });

    const openAlerts = await countOpenAlerts();
    const payload = {
      period,
      since: since.toISOString(),
      kpis: metricMap,
      openAlerts,
      series: {
        daily: daily.map((d) => ({
          date: d.day,
          turns: Number(d.turns),
          tokens: Number(d.tokens),
          costUsd: Number(d.cost_usd),
          errors: Number(d.errors),
        })),
      },
    };
    setCachedOverview(period, payload);
    return payload;
  });

  app.get("/api/v1/governance/quality", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { page, limit, skip } = parsePagination(request.query as { page?: string; limit?: string });
    const { from, to } = parseDateRange(request.query as { from?: string; to?: string; period?: string });
    const [items, total, avg] = await Promise.all([
      prisma.promptQualityScore.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.promptQualityScore.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.promptQualityScore.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _avg: { score: true, clarity: true, context: true },
      }),
    ]);
    return { page, limit, total, summary: avg._avg, items };
  });

  app.get("/api/v1/governance/observability/llm", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { page, limit, skip } = parsePagination(request.query as { page?: string; limit?: string });
    const { from, to } = parseDateRange(request.query as { from?: string; to?: string; period?: string });
    const [items, total] = await Promise.all([
      prisma.llmObservability.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.llmObservability.count({ where: { createdAt: { gte: from, lte: to } } }),
    ]);
    return { page, limit, total, items };
  });

  app.get("/api/v1/governance/costs", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const period = (request.query as { period?: string }).period || "30d";
    const days = periodToDays(period);
    const report = await buildUsageReport(days);
    const rollups = await prisma.llmCostMetric.findMany({
      where: { metricDate: { gte: periodToSince(period) } },
      orderBy: { metricDate: "desc" },
      take: 500,
    });
    return { period, report, rollups };
  });

  app.get("/api/v1/governance/security", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { page, limit, skip } = parsePagination(request.query as { page?: string; limit?: string });
    const { from, to } = parseDateRange(request.query as { from?: string; to?: string; period?: string });
    const [items, total, bySeverity] = await Promise.all([
      prisma.promptSecurityEvent.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.promptSecurityEvent.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.promptSecurityEvent.groupBy({
        by: ["severity"],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
    ]);
    return { page, limit, total, bySeverity, items };
  });

  app.get("/api/v1/governance/compliance", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const settings = await prisma.workspaceSettings.findUnique({ where: { id: "default" } });
    const [piiCount, consents, lgpdRequests, exportsCount] = await Promise.all([
      prisma.promptAnalytics.count({ where: { containsPii: true } }),
      prisma.userConsent.count(),
      prisma.lgpdRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.llmObservability.count({
        where: { toolsJson: { contains: "export" } },
      }),
    ]);
    return {
      retentionDays: settings?.retentionDays ?? 90,
      consentVersion: settings?.consentVersion ?? "1.0",
      piiFlaggedPrompts: piiCount,
      consentRecords: consents,
      lgpdRequests,
      dataExportLogs: exportsCount,
    };
  });

  app.post("/api/v1/governance/compliance/lgpd", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const body = request.body as {
      userId?: string;
      requestType?: string;
      notes?: string;
    };
    if (!body.requestType) return reply.code(400).send({ error: "requestType obrigatório" });
    const item = await prisma.lgpdRequest.create({
      data: {
        userId: body.userId,
        requestType: body.requestType,
        notes: body.notes,
        requestedBy: request.auth?.userId,
      },
    });
    return item;
  });

  app.patch("/api/v1/governance/compliance/lgpd/:id", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as { status?: string; notes?: string };
    const item = await prisma.lgpdRequest.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes,
        completedAt: body.status === "completed" ? new Date() : undefined,
      },
    });
    return item;
  });

  app.get("/api/v1/governance/usage", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const period = (request.query as { period?: string }).period || "30d";
    const since = periodToSince(period);
    const metrics = await prisma.aiGovernanceMetric.findMany({ where: { period } });
    const byCategory = await prisma.promptAnalytics.groupBy({
      by: ["promptCategory"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    const byRole = await prisma.llmObservability.findMany({
      where: { createdAt: { gte: since }, userId: { not: null } },
      select: { user: { select: { role: true } } },
    });
    const roleCounts: Record<string, number> = {};
    for (const r of byRole) {
      const role = r.user?.role ?? "unknown";
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }
    const productivity = metrics.reduce(
      (acc, m) => {
        if (m.metricKey === "hoursSavedEstimate") acc.hoursSaved = m.valueNumber ?? 0;
        if (m.metricKey === "roiBrlEstimate") acc.roiBrl = m.valueNumber ?? 0;
        return acc;
      },
      { hoursSaved: 0, roiBrl: 0, disclaimer: "Estimativa configurável (GOV_MANUAL_MINUTES_PER_DOC / GOV_HOURLY_RATE_BRL)" }
    );
    return { period, byCategory, byRole: roleCounts, productivity };
  });

  app.get("/api/v1/governance/prompts", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { page, limit, skip } = parsePagination(request.query as { page?: string; limit?: string });
    const { from, to } = parseDateRange(request.query as { from?: string; to?: string; period?: string });
    const [items, total, topHashes] = await Promise.all([
      prisma.promptAnalytics.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.promptAnalytics.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.promptAnalytics.groupBy({
        by: ["promptCategory"],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
    ]);
    return { page, limit, total, topCategories: topHashes, items };
  });

  app.get("/api/v1/governance/rag", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { page, limit, skip } = parsePagination(request.query as { page?: string; limit?: string });
    const { from, to } = parseDateRange(request.query as { from?: string; to?: string; period?: string });
    const [items, total, successRate] = await Promise.all([
      prisma.ragMetrics.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.ragMetrics.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.ragMetrics.groupBy({
        by: ["success"],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
    ]);
    return { page, limit, total, successRate, items };
  });

  app.get("/api/v1/governance/models", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { from, to } = parseDateRange(request.query as { from?: string; to?: string; period?: string });
    const grouped = await prisma.llmObservability.groupBy({
      by: ["model", "provider"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCostUsd: true },
      _avg: { latencyMs: true },
    });
    return {
      items: grouped.map((g) => ({
        model: g.model,
        provider: g.provider,
        turns: g._count._all,
        totalTokens: g._sum.totalTokens ?? 0,
        costUsd: g._sum.estimatedCostUsd ?? 0,
        avgLatencyMs: g._avg.latencyMs ?? 0,
      })),
    };
  });

  app.get("/api/v1/governance/feedback", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { page, limit, skip } = parsePagination(request.query as { page?: string; limit?: string });
    const { from, to } = parseDateRange(request.query as { from?: string; to?: string; period?: string });
    const [items, total, summary] = await Promise.all([
      prisma.llmFeedback.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { username: true } } },
      }),
      prisma.llmFeedback.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.llmFeedback.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);
    return { page, limit, total, summary, items };
  });

  app.post("/api/v1/governance/feedback", async (request, reply) => {
    if (!requireAuthenticatedUser(request, reply)) return;
    const body = request.body as {
      messageId?: string;
      conversationId?: string;
      rating?: number;
      thumbs?: string;
      comment?: string;
    };
    const item = await prisma.llmFeedback.create({
      data: {
        userId: request.auth!.userId!,
        messageId: body.messageId,
        conversationId: body.conversationId,
        rating: body.rating,
        thumbs: body.thumbs,
        comment: body.comment?.slice(0, 2000),
      },
    });
    return item;
  });

  app.get("/api/v1/governance/alerts", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const status = (request.query as { status?: string }).status;
    const where = status ? { status: status as "open" | "ack" | "resolved" } : {};
    const items = await prisma.llmAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { items, openCount: await countOpenAlerts() };
  });

  app.patch("/api/v1/governance/alerts/:id", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as { status?: "open" | "ack" | "resolved" };
    const item = await prisma.llmAlert.update({
      where: { id },
      data: {
        status: body.status,
        acknowledgedAt: body.status === "ack" ? new Date() : undefined,
        resolvedAt: body.status === "resolved" ? new Date() : undefined,
      },
    });
    return item;
  });

  app.get("/api/v1/governance/export", async (request, reply) => {
    if (!requireManagement(request, reply)) return;
    const q = request.query as { format?: string; section?: string; period?: string };
    const format = q.format || "csv";
    const section = q.section || "overview";
    const period = q.period || "30d";
    const rows = await fetchSectionRows(section, period);

    if (format === "json") {
      return { section, period, rows };
    }
    if (format === "xlsx") {
      const buf = rowsToXlsxBuffer(rows);
      reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      reply.header("Content-Disposition", `attachment; filename="governance-${section}.xlsx"`);
      return reply.send(buf);
    }
    if (format === "pdf") {
      const buf = await rowsToPdfBuffer(`Governança — ${section}`, rows);
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="governance-${section}.pdf"`);
      return reply.send(buf);
    }
    const csv = rowsToCsv(rows);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="governance-${section}.csv"`);
    return reply.send(csv);
  });
}

export async function governanceIngestRoutes(app: FastifyInstance) {
  app.post("/api/v1/internal/governance/ingest", async (request, reply) => {
    const body = request.body as { events?: IngestEvent[] };
    if (!Array.isArray(body.events) || !body.events.length) {
      return reply.code(400).send({ error: "events[] obrigatório" });
    }
    const result = await ingestGovernanceEvents(body.events);
    return result;
  });
}
