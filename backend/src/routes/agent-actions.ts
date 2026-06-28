import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db";
import { isAdmin } from "../core/roles";
import { requireAuthenticatedUser } from "../middleware/auth";
import { executeApprovedAction } from "../services/action-broker";

const ACTION_TTL_MIN = Number(process.env.ACTION_TTL_MIN || 15);

const RISK_LEVELS = new Set(["low", "medium", "high"]);

export async function agentActionsRoutes(app: FastifyInstance) {
  app.get("/api/v1/agent/actions/pending", async (request, reply) => {
    if (!requireAuthenticatedUser(request, reply)) return;
    const userId = request.auth!.userId!;
    const now = new Date();
    const rows = await prisma.pendingAction.findMany({
      where: { userId, status: "pending", expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return { actions: rows.map(serializeAction) };
  });

  app.post<{ Params: { id: string } }>(
    "/api/v1/agent/actions/:id/approve",
    async (request, reply) => {
      if (!requireAuthenticatedUser(request, reply)) return;
      const userId = request.auth!.userId!;
      const role = request.auth!.role;
      const row = await prisma.pendingAction.findUnique({ where: { id: request.params.id } });
      if (!row || row.userId !== userId) {
        return reply.code(404).send({ error: "Ação não encontrada." });
      }
      if (row.status !== "pending") {
        return reply.code(400).send({ error: `Ação já está ${row.status}.` });
      }
      if (row.expiresAt < new Date()) {
        await prisma.pendingAction.update({
          where: { id: row.id },
          data: { status: "expired" },
        });
        return reply.code(410).send({ error: "Ação expirada." });
      }
      if (row.risk === "high" && !isAdmin(role)) {
        return reply.code(403).send({ error: "Ações de alto risco exigem perfil admin." });
      }
      try {
        const result = await executeApprovedAction(row, userId);
        const updated = await prisma.pendingAction.update({
          where: { id: row.id },
          data: {
            status: "executed",
            approvedAt: new Date(),
            executedAt: new Date(),
            resultJson: JSON.stringify(result),
          },
        });
        return { action: serializeAction(updated), result };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await prisma.pendingAction.update({
          where: { id: row.id },
          data: { status: "failed", error: msg, approvedAt: new Date() },
        });
        return reply.code(500).send({ error: msg });
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/agent/actions/:id/reject",
    async (request, reply) => {
      if (!requireAuthenticatedUser(request, reply)) return;
      const userId = request.auth!.userId!;
      const row = await prisma.pendingAction.findUnique({ where: { id: request.params.id } });
      if (!row || row.userId !== userId) {
        return reply.code(404).send({ error: "Ação não encontrada." });
      }
      if (row.status !== "pending") {
        return reply.code(400).send({ error: `Ação já está ${row.status}.` });
      }
      const updated = await prisma.pendingAction.update({
        where: { id: row.id },
        data: { status: "rejected" },
      });
      return { action: serializeAction(updated) };
    }
  );
}

export async function internalActionsRoutes(app: FastifyInstance) {
  app.post("/api/v1/internal/actions/propose", async (request, reply) => {
    const body = request.body as {
      userId?: string;
      conversationId?: string;
      actionType?: string;
      params?: Record<string, unknown>;
      summary?: string;
      risk?: string;
    };
    if (!body.userId || !body.actionType || !body.summary) {
      return reply.code(400).send({ error: "userId, actionType e summary são obrigatórios." });
    }
    const risk = RISK_LEVELS.has(body.risk || "") ? body.risk! : "medium";
    const expiresAt = new Date(Date.now() + ACTION_TTL_MIN * 60_000);
    const row = await prisma.pendingAction.create({
      data: {
        userId: body.userId,
        conversationId: body.conversationId || null,
        actionType: body.actionType,
        paramsJson: JSON.stringify(body.params || {}),
        summary: body.summary.slice(0, 500),
        risk,
        expiresAt,
      },
    });
    return {
      action_id: row.id,
      status: row.status,
      summary: row.summary,
      action_type: row.actionType,
      risk: row.risk,
      expires_at: row.expiresAt.toISOString(),
    };
  });
}

function serializeAction(row: {
  id: string;
  actionType: string;
  summary: string;
  risk: string;
  status: string;
  paramsJson: string;
  resultJson: string | null;
  error: string | null;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: row.id,
    actionType: row.actionType,
    summary: row.summary,
    risk: row.risk,
    status: row.status,
    params: safeJson(row.paramsJson),
    result: row.resultJson ? safeJson(row.resultJson) : null,
    error: row.error,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
