import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireConversationAuditSession } from "@/lib/api-server";

const ROUTE_MAP: Record<string, string> = {
  overview: "/api/v1/conversation-intelligence/overview",
  conversations: "/api/v1/conversation-intelligence/conversations",
  search: "/api/v1/conversation-intelligence/search",
  export: "/api/v1/conversation-intelligence/export",
  usage: "/api/v1/conversation-intelligence/usage",
  productivity: "/api/v1/conversation-intelligence/productivity",
  security: "/api/v1/conversation-intelligence/security",
  compliance: "/api/v1/conversation-intelligence/compliance",
};

async function proxy(req: NextRequest, backendPath: string) {
  await requireConversationAuditSession();
  const qs = req.nextUrl.searchParams.toString();
  const url = qs ? `${backendPath}?${qs}` : backendPath;
  const init: RequestInit = { method: req.method };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
    init.headers = { "Content-Type": req.headers.get("content-type") || "application/json" };
  }
  const res = await backendFetch(url, init);
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return NextResponse.json(await res.json(), { status: res.status });
  }
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: res.status,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": res.headers.get("content-disposition") || "",
    },
  });
}

function handleError(e: unknown) {
  if (e instanceof Error && e.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  return NextResponse.json({ error: "Erro" }, { status: 500 });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await ctx.params;
    const key = path.join("/");
    if (key.startsWith("conversations/") && path.length >= 3 && path[2] === "messages") {
      const [_, id, __, msgId, action] = path;
      if (action === "audit") {
        return proxy(req, `/api/v1/conversation-intelligence/conversations/${id}/messages/${msgId}/audit`);
      }
    }
    if (key.startsWith("conversations/") && path.length === 3 && path[2] === "export") {
      return proxy(req, `/api/v1/conversation-intelligence/conversations/${path[1]}/export`);
    }
    if (key.startsWith("conversations/") && path.length === 2) {
      return proxy(req, `/api/v1/conversation-intelligence/conversations/${path[1]}`);
    }
    const backendPath = ROUTE_MAP[path[0]];
    if (!backendPath) return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
    return proxy(req, backendPath);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await ctx.params;
    if (path[0] === "conversations" && path[2] === "anonymize") {
      return proxy(req, `/api/v1/conversation-intelligence/conversations/${path[1]}/anonymize`);
    }
    if (path[0] === "conversations" && path[2] === "view") {
      return proxy(req, `/api/v1/conversation-intelligence/conversations/${path[1]}/view`);
    }
    const backendPath = ROUTE_MAP[path[0]];
    if (!backendPath) return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
    return proxy(req, backendPath);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await ctx.params;
    if (path[0] === "conversations" && path.length === 2) {
      return proxy(req, `/api/v1/conversation-intelligence/conversations/${path[1]}`);
    }
    return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
  } catch (e) {
    return handleError(e);
  }
}
