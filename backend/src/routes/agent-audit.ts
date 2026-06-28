import type { FastifyInstance } from "fastify";
import { prisma } from "../db";

export async function agentAuditRoutes(app: FastifyInstance) {
  app.post("/api/v1/agent/audit", async (request, reply) => {
    if (!request.auth?.service && !request.auth?.userId) {
      return reply.code(401).send({ error: "Não autorizado" });
    }
    const body = request.body as {
      userId?: string;
      conversationId?: string;
      question?: string;
      analysisType?: string;
      toolsCalled?: string[] | unknown;
      modelUsed?: string;
      latencyMs?: number;
      error?: string;
      route?: string;
      recordsReturned?: number;
      sources?: string[];
    };
    const toolsPayload = body.toolsCalled
      ? JSON.stringify({
          tools: body.toolsCalled,
          route: body.route,
          recordsReturned: body.recordsReturned,
          sources: body.sources,
        })
      : body.route
        ? JSON.stringify({ route: body.route, recordsReturned: body.recordsReturned, sources: body.sources })
        : null;
    const log = await prisma.agentAuditLog.create({
      data: {
        userId: body.userId || request.auth.userId,
        conversationId: body.conversationId,
        question: body.question?.slice(0, 500),
        analysisType: body.analysisType,
        toolsCalled: toolsPayload,
        modelUsed: body.modelUsed,
        latencyMs: body.latencyMs,
        error: body.error?.slice(0, 500),
      },
    });
    return { id: log.id };
  });
}
