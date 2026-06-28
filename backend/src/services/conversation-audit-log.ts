import { prisma } from "../db";

export async function logConversationView(
  conversationId: string,
  viewerUserId: string,
  viewerRole?: string
): Promise<void> {
  await Promise.all([
    prisma.conversationView.create({
      data: { conversationId, viewerUserId, viewerRole },
    }),
    prisma.conversationAudit.create({
      data: {
        conversationId,
        actorUserId: viewerUserId,
        action: "view",
        detailsJson: JSON.stringify({ viewerRole }),
      },
    }),
  ]);
}

export async function logConversationAction(
  conversationId: string | null,
  actorUserId: string | undefined,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  await prisma.conversationAudit.create({
    data: {
      conversationId: conversationId ?? undefined,
      actorUserId,
      action,
      detailsJson: details ? JSON.stringify(details) : null,
    },
  });
}

export async function logConversationExport(
  actorUserId: string | undefined,
  format: string,
  section: string | undefined,
  recordCount: number,
  filters?: Record<string, unknown>
): Promise<void> {
  await prisma.conversationExport.create({
    data: {
      actorUserId,
      format,
      section,
      recordCount,
      filtersJson: filters ? JSON.stringify(filters) : null,
    },
  });
  await logConversationAction(null, actorUserId, "export", { format, section, recordCount });
}
