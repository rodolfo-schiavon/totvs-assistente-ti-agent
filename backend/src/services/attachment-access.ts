import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db";
import type { RequestAuth } from "../middleware/auth";
import { resolveDbUserId } from "./resolve-user";

async function userOwnsAttachment(auth: RequestAuth | undefined, attachmentId: string): Promise<boolean> {
  const userId = await resolveDbUserId(auth);
  if (!userId) return false;

  const att = await prisma.agentMessageAttachment.findUnique({ where: { id: attachmentId } });
  if (!att) return false;

  if (att.uploadedByUserId === userId) return true;

  if (att.conversationId) {
    const conv = await prisma.agentConversation.findFirst({
      where: { id: att.conversationId, userId },
    });
    return Boolean(conv);
  }

  return false;
}

export async function assertAttachmentAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  attachmentId: string
) {
  const att = await prisma.agentMessageAttachment.findUnique({ where: { id: attachmentId } });
  if (!att) {
    reply.code(404).send({ error: "Anexo não encontrado" });
    return null;
  }

  if (!(await userOwnsAttachment(request.auth, attachmentId))) {
    reply.code(403).send({ error: "Acesso negado ao anexo." });
    return null;
  }

  return att;
}

export async function filterAccessibleAttachmentIds(
  request: FastifyRequest,
  reply: FastifyReply,
  ids: string[]
): Promise<string[] | null> {
  for (const id of ids) {
    if (!(await userOwnsAttachment(request.auth, id))) {
      reply.code(403).send({ error: "Acesso negado ao anexo." });
      return null;
    }
  }
  return ids;
}
