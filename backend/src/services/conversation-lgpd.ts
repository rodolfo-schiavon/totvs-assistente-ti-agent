import { createHash } from "node:crypto";
import { prisma } from "../db";
import { logConversationAction } from "./conversation-audit-log";

export async function anonymizeConversation(conversationId: string, actorUserId: string): Promise<void> {
  const messages = await prisma.agentMessage.findMany({ where: { conversationId } });
  for (const m of messages) {
    const hash = createHash("sha256").update(m.content).digest("hex").slice(0, 16);
    await prisma.agentMessage.update({
      where: { id: m.id },
      data: {
        content: JSON.stringify({
          type: "anonymized",
          markdown: `[Conteúdo anonimizado — ref ${hash}]`,
        }),
        usageJson: null,
      },
    });
  }

  await prisma.conversationCompliance.upsert({
    where: { conversationId },
    create: { conversationId, anonymized: true, notes: "Anonimizado via CIC" },
    update: { anonymized: true, updatedAt: new Date() },
  });

  await prisma.conversationMetrics.updateMany({
    where: { conversationId },
    data: { status: "anonymized", searchText: "[anonimizado]" },
  });

  await logConversationAction(conversationId, actorUserId, "anonymize");
}

export async function softDeleteConversation(conversationId: string, actorUserId: string): Promise<void> {
  const now = new Date();
  await prisma.agentConversation.update({
    where: { id: conversationId },
    data: { deletedAt: now },
  });
  await prisma.conversationCompliance.upsert({
    where: { conversationId },
    create: { conversationId, deletedAt: now },
    update: { deletedAt: now, updatedAt: now },
  });
  await prisma.conversationMetrics.updateMany({
    where: { conversationId },
    data: { status: "deleted" },
  });
  await logConversationAction(conversationId, actorUserId, "delete");
}
