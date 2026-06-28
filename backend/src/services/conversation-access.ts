import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db";
import { resolveDbUserId } from "./resolve-user";

/** Garante que a conversa pertence ao usuário autenticado (nunca confia só em service auth). */
export async function assertConversationOwner(
  request: FastifyRequest,
  reply: FastifyReply,
  conversationId: string
) {
  const userId = await resolveDbUserId(request.auth);
  if (!userId) {
    reply.code(401).send({ error: "Não autorizado" });
    return null;
  }

  const conv = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conv) {
    reply.code(404).send({ error: "Conversa não encontrada" });
    return null;
  }
  return conv;
}
