import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { prisma } from "../db";
import { isValidRole } from "../core/roles";
import { hashPassword } from "../services/password";
import { generateTemporaryPassword } from "../services/password-policy";
import { requireAdmin } from "../middleware/auth";

function parseRole(value?: string): UserRole {
  if (value && isValidRole(value)) return value as UserRole;
  return UserRole.gerencia;
}

export async function usersRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/users", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const users = await prisma.user.findMany({
      orderBy: { username: "asc" },
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        mustChangePassword: true,
        passwordChangedAt: true,
        createdAt: true,
      },
    });
    return { users };
  });

  app.post("/api/v1/admin/users", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const body = request.body as { username?: string; role?: string };
    const username = body.username?.trim();
    if (!username) {
      return reply.code(400).send({ error: "Usuário é obrigatório." });
    }
    const temporaryPassword = generateTemporaryPassword();
    const role = parseRole(body.role);
    const now = new Date();
    try {
      const user = await prisma.user.create({
        data: {
          username,
          passwordHash: hashPassword(temporaryPassword),
          role,
          active: true,
          mustChangePassword: true,
          passwordChangedAt: now,
        },
        select: { id: true, username: true, role: true, active: true, mustChangePassword: true },
      });
      return { ...user, temporaryPassword };
    } catch {
      return reply.code(409).send({ error: "Usuário já existe." });
    }
  });

  app.patch("/api/v1/admin/users/:id", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as { role?: string; active?: boolean; resetPassword?: boolean };
    const data: {
      role?: UserRole;
      active?: boolean;
      passwordHash?: string;
      mustChangePassword?: boolean;
      passwordChangedAt?: Date;
    } = {};
    if (body.role && isValidRole(body.role)) data.role = body.role as UserRole;
    if (typeof body.active === "boolean") {
      if (body.active === false && request.auth?.userId === id) {
        return reply.code(400).send({ error: "Não é possível desativar o próprio usuário." });
      }
      data.active = body.active;
    }
    if (body.resetPassword) {
      const temporaryPassword = generateTemporaryPassword();
      data.passwordHash = hashPassword(temporaryPassword);
      data.mustChangePassword = true;
      data.passwordChangedAt = new Date();
      const user = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, username: true, role: true, active: true, mustChangePassword: true },
      });
      return { ...user, temporaryPassword };
    }
    if (!Object.keys(data).length) {
      return reply.code(400).send({ error: "Nenhuma alteração informada." });
    }
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, active: true, mustChangePassword: true },
    });
    return user;
  });

  app.delete("/api/v1/admin/users/:id", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    if (request.auth?.userId === id) {
      return reply.code(400).send({ error: "Não é possível excluir o próprio usuário." });
    }
    await prisma.user.delete({ where: { id } });
    return { ok: true };
  });
}
