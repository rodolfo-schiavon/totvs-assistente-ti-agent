import { getSession, SESSION_COOKIE } from "@/lib/auth";
import { canViewManagementReports, isAdmin } from "@/lib/roles";
import { cookies } from "next/headers";
import { resolveAgentUrl } from "@/lib/service-url";

function apiBase(): string {
  const url = process.env.API_URL?.replace(/\/$/, "");
  if (!url) throw new Error("API_URL não configurado");
  return url;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireAdminSession() {
  const session = await requireSession();
  if (!isAdmin(session.role)) throw new Error("FORBIDDEN");
  return session;
}

export async function requireManagementSession() {
  const session = await requireSession();
  if (!canViewManagementReports(session.role)) throw new Error("FORBIDDEN");
  return session;
}

export async function requireConversationAuditSession() {
  const session = await requireSession();
  if (!canViewManagementReports(session.role)) throw new Error("FORBIDDEN");
  return session;
}

export function clientContextHeaders(req: { headers: Headers }): Record<string, string> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  const ua = req.headers.get("user-agent") || "";
  const out: Record<string, string> = {};
  if (ip) out["X-Client-Ip"] = ip;
  if (ua) out["X-User-Agent"] = ua.slice(0, 512);
  return out;
}

export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const secret = process.env.API_SECRET;
  if (!secret) throw new Error("API_SECRET não configurado");

  const headers = new Headers(init?.headers);
  headers.set("X-Api-Secret", secret);

  const session = await getSession();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (session) {
    headers.set("X-User-Id", session.userId);
    headers.set("X-User-Username", session.username);
    headers.set("X-User-Role", session.role);
  }

  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export function agentBase(): string {
  return resolveAgentUrl();
}
