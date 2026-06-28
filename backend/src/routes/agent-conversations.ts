import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { resolveDbUserId } from "../services/resolve-user";
import { searchUserConversations } from "../services/conversation-search";
import { processMessageSideEffects } from "../services/conversation-message-hooks";

function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 56 ? `${t.slice(0, 53)}…` : t;
}

export async function agentConversationRoutes(app: FastifyInstance) {
  app.get("/api/v1/agent/conversations/search", async (request, reply) => {
    const userId = await resolveDbUserId(request.auth);
    if (!userId) return reply.code(401).send({ error: "Não autorizado" });
    const q = request.query as { q?: string; limit?: string };
    const limit = parseInt(q.limit || "30", 10) || 30;
    return searchUserConversations(userId, q.q || "", limit);
  });

  app.get("/api/v1/agent/conversations", async (request, reply) => {
    const userId = await resolveDbUserId(request.auth);
    if (!userId) return reply.code(401).send({ error: "Não autorizado" });

    const items = await prisma.agentConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    return {
      conversations: items.map((c) => ({
        id: c.id,
        title: c.title || "Nova conversa",
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c._count.messages,
      })),
    };
  });

  app.post("/api/v1/agent/conversations", async (request, reply) => {
    const userId = await resolveDbUserId(request.auth);
    if (!userId) return reply.code(401).send({ error: "Não autorizado" });

    const body = (request.body || {}) as { title?: string };
    const clientIp = request.headers["x-client-ip"];
    const userAgent = request.headers["x-user-agent"];
    const conv = await prisma.agentConversation.create({
      data: {
        userId,
        title: body.title?.trim() || "Nova conversa",
        clientIp: typeof clientIp === "string" ? clientIp.slice(0, 64) : undefined,
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 512) : undefined,
      },
    });

    return {
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    };
  });

  app.get("/api/v1/agent/conversations/:id", async (request, reply) => {
    const userId = await resolveDbUserId(request.auth);
    if (!userId) return reply.code(401).send({ error: "Não autorizado" });

    const { id } = request.params as { id: string };
    const conv = await prisma.agentConversation.findFirst({
      where: { id, userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conv) return reply.code(404).send({ error: "Conversa não encontrada" });

    return {
      id: conv.id,
      title: conv.title,
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: tryParseJson(m.content),
        usage: m.usageJson ? JSON.parse(m.usageJson) : undefined,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });

  app.delete("/api/v1/agent/conversations/:id", async (request, reply) => {
    const userId = await resolveDbUserId(request.auth);
    if (!userId) return reply.code(401).send({ error: "Não autorizado" });

    const { id } = request.params as { id: string };
    const conv = await prisma.agentConversation.findFirst({ where: { id, userId } });
    if (!conv) return reply.code(404).send({ error: "Conversa não encontrada" });

    await prisma.agentConversation.delete({ where: { id } });
    return { ok: true };
  });

  app.post("/api/v1/agent/conversations/:id/messages", async (request, reply) => {
    const userId = await resolveDbUserId(request.auth);
    if (!userId) return reply.code(401).send({ error: "Não autorizado" });

    const { id } = request.params as { id: string };
    const body = request.body as {
      role: string;
      content: unknown;
      usage?: unknown;
      titleHint?: string;
    };

    const conv = await prisma.agentConversation.findFirst({ where: { id, userId } });
    if (!conv) return reply.code(404).send({ error: "Conversa não encontrada" });

    const contentStr =
      typeof body.content === "string" ? body.content : JSON.stringify(body.content ?? {});

    const msg = await prisma.agentMessage.create({
      data: {
        conversationId: id,
        role: body.role,
        content: contentStr,
        usageJson: body.usage ? JSON.stringify(body.usage) : null,
      },
    });

    const updates: { updatedAt: Date; title?: string } = { updatedAt: new Date() };
    if (body.role === "user" && (!conv.title || conv.title === "Nova conversa") && body.titleHint) {
      updates.title = titleFrom(body.titleHint);
    }

    const sessionPatch: { clientIp?: string; userAgent?: string } = {};
    const clientIp = request.headers["x-client-ip"];
    const userAgent = request.headers["x-user-agent"];
    if (!conv.clientIp && typeof clientIp === "string") sessionPatch.clientIp = clientIp.slice(0, 64);
    if (!conv.userAgent && typeof userAgent === "string") sessionPatch.userAgent = userAgent.slice(0, 512);

    await prisma.agentConversation.update({ where: { id }, data: { ...updates, ...sessionPatch } });

    processMessageSideEffects(msg.id, id, body.role, contentStr).catch(() => undefined);

    return { id: msg.id, createdAt: msg.createdAt.toISOString() };
  });

  app.patch("/api/v1/agent/conversations/:id", async (request, reply) => {
    const userId = await resolveDbUserId(request.auth);
    if (!userId) return reply.code(401).send({ error: "Não autorizado" });

    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { title?: string };
    const title = body.title?.trim();
    if (!title) return reply.code(400).send({ error: "Título inválido" });

    const conv = await prisma.agentConversation.findFirst({ where: { id, userId } });
    if (!conv) return reply.code(404).send({ error: "Conversa não encontrada" });

    const updated = await prisma.agentConversation.update({
      where: { id },
      data: { title, updatedAt: new Date() },
    });

    return {
      id: updated.id,
      title: updated.title,
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
