import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { canViewManagementReports, isAdmin, normalizeRole } from "@/lib/roles";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/health"];
const PASSWORD_PATH = "/change-password";
const PASSWORD_API = "/api/auth/change-password";
const SESSION_STATUS_API = "/api/auth/session-status";
const ADMIN_PREFIX = "/dashboard/admin";
const GOVERNANCE_PREFIX = "/dashboard/admin/governance";
const CONVERSATIONS_PREFIX = "/dashboard/admin/conversations";
const KNOWLEDGE_PREFIX = "/dashboard/admin/knowledge";
const ADMIN_API_PREFIX = "/api/admin";
const KNOWLEDGE_API_PREFIX = "/api/admin/knowledge";
const GOVERNANCE_API_PREFIX = "/api/governance";
const CONVERSATIONS_API_PREFIX = "/api/conversation-intelligence";
const MANAGEMENT_PREFIX = "/dashboard/management";
const MANAGEMENT_API_PREFIX = "/api/management";
const CONSENT_PATH = "/consent";

function secretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function getRole(token: string | undefined) {
  if (!token) return null;
  const key = secretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    if (!payload.sub) return null;
    return normalizeRole(payload.role as string);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const role = await getRole(token);
  if (!role) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    pathname.startsWith(ADMIN_PREFIX) &&
    !pathname.startsWith(GOVERNANCE_PREFIX) &&
    !pathname.startsWith(CONVERSATIONS_PREFIX) &&
    !pathname.startsWith(KNOWLEDGE_PREFIX) &&
    !isAdmin(role)
  ) {
    return NextResponse.redirect(new URL("/dashboard/executive", request.url));
  }

  if (pathname.startsWith(KNOWLEDGE_PREFIX) && !canViewManagementReports(role)) {
    return NextResponse.redirect(new URL("/dashboard/executive", request.url));
  }

  if (pathname.startsWith(GOVERNANCE_PREFIX) && !canViewManagementReports(role)) {
    return NextResponse.redirect(new URL("/dashboard/executive", request.url));
  }

  if (pathname.startsWith(CONVERSATIONS_PREFIX) && !canViewManagementReports(role)) {
    return NextResponse.redirect(new URL("/dashboard/executive", request.url));
  }

  if (
    pathname.startsWith(ADMIN_API_PREFIX) &&
    !pathname.startsWith(KNOWLEDGE_API_PREFIX) &&
    !isAdmin(role)
  ) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (pathname.startsWith(KNOWLEDGE_API_PREFIX) && !canViewManagementReports(role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (pathname.startsWith(GOVERNANCE_API_PREFIX) && !canViewManagementReports(role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (pathname.startsWith(CONVERSATIONS_API_PREFIX) && !canViewManagementReports(role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (pathname.startsWith(MANAGEMENT_PREFIX) && pathname.includes("/reports")) {
    const url = new URL("/dashboard/admin/governance/costs", request.url);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith(MANAGEMENT_PREFIX) && !canViewManagementReports(role)) {
    return NextResponse.redirect(new URL("/dashboard/executive", request.url));
  }

  if (pathname.startsWith(MANAGEMENT_API_PREFIX) && !canViewManagementReports(role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const skipSessionGate =
    pathname.startsWith(PASSWORD_PATH) ||
    pathname.startsWith(PASSWORD_API) ||
    pathname.startsWith(SESSION_STATUS_API) ||
    pathname.startsWith(CONSENT_PATH) ||
    pathname.startsWith("/api/consent/");

  if (!skipSessionGate) {
    const statusRes = await fetch(new URL(SESSION_STATUS_API, request.url), {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }).catch(() => null);
    if (statusRes?.ok) {
      const data = await statusRes.json().catch(() => ({}));
      if (data.mustChangePassword || data.passwordExpired) {
        if (!pathname.startsWith("/api/")) {
          const url = new URL(PASSWORD_PATH, request.url);
          if (data.passwordExpired) url.searchParams.set("expired", "1");
          return NextResponse.redirect(url);
        }
        return NextResponse.json({ error: "Senha deve ser alterada." }, { status: 403 });
      }
      if (!data.aiNoticeDismissed) {
        if (!pathname.startsWith("/api/")) {
          return NextResponse.redirect(new URL(CONSENT_PATH, request.url));
        }
        return NextResponse.json({ error: "Consentimento pendente." }, { status: 403 });
      }
    }
  }

  if (
    pathname.startsWith(PASSWORD_PATH) &&
    !pathname.startsWith("/api/")
  ) {
    const statusRes = await fetch(new URL(SESSION_STATUS_API, request.url), {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }).catch(() => null);
    if (statusRes?.ok) {
      const data = await statusRes.json().catch(() => ({}));
      if (!data.mustChangePassword && !data.passwordExpired && data.aiNoticeDismissed) {
        return NextResponse.redirect(new URL("/dashboard/executive", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
