import { timingSafeEqual } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { LegalRole } from "../core/roles";
import { canAuditAllConversations } from "../core/conversation-permissions";
import { canViewManagementReports, isAdmin, isValidRole, normalizeRole } from "../core/roles";
import { verifyToken } from "../services/jwt";
import { resolveDbUserId } from "../services/resolve-user";

const PUBLIC_PATHS = new Set([
  "/api/v1/health",
  "/api/v1/auth/login",
]);

const INTERNAL_PATHS_PREFIX = "/api/v1/internal/";

export type { LegalRole };

export type RequestAuth = {
  userId?: string;
  username?: string;
  role?: LegalRole;
  service?: boolean;
  jwt?: boolean;
};

declare module "fastify" {
  interface FastifyRequest {
    auth?: RequestAuth;
  }
}

function safeEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export async function apiAuth(request: FastifyRequest, reply: FastifyReply) {
  const path = request.url.split("?")[0];

  if (PUBLIC_PATHS.has(path)) return;

  if (path.startsWith(INTERNAL_PATHS_PREFIX)) {
    const agentSecret = process.env.AGENT_SERVICE_SECRET;
    const header = request.headers["x-agent-secret"];
    if (!agentSecret || typeof header !== "string" || !safeEqual(header, agentSecret)) {
      return reply.code(401).send({ error: "Não autorizado (agente)." });
    }
    request.auth = { service: true };
    return;
  }

  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    const payload = await verifyToken(bearer);
    if (payload) {
      request.auth = {
        userId: payload.sub,
        username: payload.username || payload.sub,
        role: payload.role,
        jwt: true,
      };
      const dbUserId = await resolveDbUserId(request.auth);
      if (dbUserId) request.auth.userId = dbUserId;
      return;
    }
  }

  const secret = process.env.API_SECRET;
  if (!secret) {
    return reply.code(503).send({ error: "API_SECRET não configurado." });
  }
  const apiHeader = request.headers["x-api-secret"];
  if (typeof apiHeader !== "string" || !safeEqual(apiHeader, secret)) {
    return reply.code(401).send({ error: "Não autorizado." });
  }

  const userId = request.headers["x-user-id"];
  const usernameHeader = request.headers["x-user-username"];
  const roleHeader = request.headers["x-user-role"];
  request.auth = {
    service: true,
    userId: typeof userId === "string" ? userId : undefined,
    username:
      typeof usernameHeader === "string"
        ? usernameHeader
        : typeof userId === "string"
          ? userId
          : undefined,
    role: isValidRole(typeof roleHeader === "string" ? roleHeader : undefined)
      ? normalizeRole(typeof roleHeader === "string" ? roleHeader : undefined)
      : undefined,
  };
  const dbUserId = await resolveDbUserId(request.auth);
  if (dbUserId) request.auth.userId = dbUserId;
}

/** Exige JWT de usuário real com perfil admin (não aceita só headers de serviço). */
export function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.auth?.jwt && isAdmin(request.auth.role)) return true;
  reply.code(403).send({ error: "Acesso restrito a administradores." });
  return false;
}

/** Exige JWT com perfil admin ou gerencia (relatórios consolidados). */
export function requireManagement(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.auth?.jwt && canViewManagementReports(request.auth.role)) return true;
  reply.code(403).send({ error: "Acesso restrito à gerência e administradores." });
  return false;
}

export function requireAuthenticatedUser(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.auth?.jwt && request.auth.userId) return true;
  reply.code(401).send({ error: "Não autenticado." });
  return false;
}

/** Admin ou gerencia para Conversation Intelligence Center. */
export function requireConversationAudit(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.auth?.jwt && canAuditAllConversations(request.auth.role)) return true;
  reply.code(403).send({ error: "Acesso restrito à auditoria de conversas." });
  return false;
}
