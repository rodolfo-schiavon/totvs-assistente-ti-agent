import type { FastifyInstance } from "fastify";
import { prisma } from "../db";

const DEFAULT_VERSION = process.env.CONSENT_VERSION || "1.0";

export async function consentRoutes(app: FastifyInstance) {
  app.get("/api/v1/consent/status", async (request, reply) => {
    const userId = request.auth?.userId;
    if (!userId) return reply.code(401).send({ error: "Não autenticado." });

    const settings = await prisma.workspaceSettings.findUnique({ where: { id: "default" } });
    const version = settings?.consentVersion || DEFAULT_VERSION;
    const existing = await prisma.userConsent.findUnique({
      where: { userId_consentVersion: { userId, consentVersion: version } },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiNoticeDismissed: true },
    });

    return {
      consentVersion: version,
      accepted: Boolean(user?.aiNoticeDismissed && existing),
      acceptedAt: existing?.acceptedAt ?? null,
      requiresAcknowledgement: !user?.aiNoticeDismissed,
    };
  });

  app.post("/api/v1/consent/accept", async (request, reply) => {
    const userId = request.auth?.userId;
    if (!userId) return reply.code(401).send({ error: "Não autenticado." });

    const body = (request.body || {}) as { dismissNotice?: boolean };
    if (!body.dismissNotice) {
      return reply.code(400).send({
        error: "É necessário aceitar os termos e marcar que leu o aviso para continuar.",
      });
    }

    const settings = await prisma.workspaceSettings.upsert({
      where: { id: "default" },
      create: { id: "default", consentVersion: DEFAULT_VERSION, retentionDays: 90 },
      update: {},
    });

    const ip = (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim();
    await prisma.$transaction([
      prisma.userConsent.upsert({
        where: {
          userId_consentVersion: { userId, consentVersion: settings.consentVersion },
        },
        create: { userId, consentVersion: settings.consentVersion, ipAddress: ip },
        update: { acceptedAt: new Date(), ipAddress: ip },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { aiNoticeDismissed: true },
      }),
    ]);

    return { ok: true, consentVersion: settings.consentVersion };
  });
}
