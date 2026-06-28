import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../services/password";
import {
  passwordStatus,
  validateStrongPassword,
} from "../services/password-policy";
import { normalizeRole } from "../core/roles";
import { signToken } from "../services/jwt";

function authPayload(user: {
  id: string;
  username: string;
  role: string;
  mustChangePassword: boolean;
  passwordChangedAt: Date;
  aiNoticeDismissed: boolean;
}) {
  const pwd = passwordStatus(user.passwordChangedAt, user.mustChangePassword);
  return {
    token: null as string | null,
    user: { id: user.id, username: user.username, role: normalizeRole(user.role) },
    ...pwd,
    aiNoticeDismissed: user.aiNoticeDismissed,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = request.body as { username?: string; password?: string };
    const username = body?.username?.trim();
    const password = body?.password;
    if (!username || !password) {
      return reply.code(400).send({ error: "Usuário e senha são obrigatórios." });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: "Credenciais inválidas." });
    }

    const role = normalizeRole(user.role);
    const token = await signToken({ sub: user.id, role, username: user.username });
    const base = authPayload(user);
    return { ...base, token };
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: "Não autenticado." });
    }
    const user = await prisma.user.findUnique({ where: { id: request.auth.userId } });
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Usuário inválido." });
    }
    return {
      id: user.id,
      username: user.username,
      role: normalizeRole(user.role),
      ...passwordStatus(user.passwordChangedAt, user.mustChangePassword),
      aiNoticeDismissed: user.aiNoticeDismissed,
    };
  });

  app.get("/api/v1/auth/session-status", async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: "Não autenticado." });
    }
    const user = await prisma.user.findUnique({ where: { id: request.auth.userId } });
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Usuário inválido." });
    }
    const settings = await prisma.workspaceSettings.findUnique({ where: { id: "default" } });
    const version = settings?.consentVersion || "1.0";
    const consent = await prisma.userConsent.findUnique({
      where: { userId_consentVersion: { userId: user.id, consentVersion: version } },
    });
    return {
      ...passwordStatus(user.passwordChangedAt, user.mustChangePassword),
      aiNoticeDismissed: user.aiNoticeDismissed,
      consentAccepted: Boolean(consent),
      consentVersion: version,
    };
  });

  app.post("/api/v1/auth/change-password", async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: "Não autenticado." });
    }
    const body = request.body as { currentPassword?: string; newPassword?: string };
    const newPassword = body.newPassword || "";
    const check = validateStrongPassword(newPassword);
    if (!check.ok) return reply.code(400).send({ error: check.error });

    const user = await prisma.user.findUnique({ where: { id: request.auth.userId } });
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Usuário inválido." });
    }

    const mustProvideCurrent = !user.mustChangePassword;
    if (mustProvideCurrent) {
      const current = body.currentPassword || "";
      if (!current || !verifyPassword(current, user.passwordHash)) {
        return reply.code(400).send({ error: "Senha atual incorreta." });
      }
      if (verifyPassword(newPassword, user.passwordHash)) {
        return reply.code(400).send({ error: "A nova senha deve ser diferente da atual." });
      }
    }

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(newPassword),
        mustChangePassword: false,
        passwordChangedAt: now,
      },
    });

    return {
      ok: true,
      ...passwordStatus(now, false),
    };
  });
}
