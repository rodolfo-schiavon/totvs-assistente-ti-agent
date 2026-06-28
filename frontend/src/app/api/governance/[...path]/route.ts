import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireManagementSession } from "@/lib/api-server";

const ROUTE_MAP: Record<string, string> = {
  overview: "/api/v1/governance/overview",
  quality: "/api/v1/governance/quality",
  "observability/llm": "/api/v1/governance/observability/llm",
  costs: "/api/v1/governance/costs",
  security: "/api/v1/governance/security",
  compliance: "/api/v1/governance/compliance",
  usage: "/api/v1/governance/usage",
  prompts: "/api/v1/governance/prompts",
  rag: "/api/v1/governance/rag",
  models: "/api/v1/governance/models",
  feedback: "/api/v1/governance/feedback",
  alerts: "/api/v1/governance/alerts",
  export: "/api/v1/governance/export",
};

async function proxy(req: NextRequest, backendPath: string) {
  await requireManagementSession();
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await ctx.params;
    const key = path.join("/");
    const backendPath = ROUTE_MAP[key];
    if (!backendPath) return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
    return proxy(req, backendPath);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await ctx.params;
    const key = path.join("/");
    if (key === "feedback") {
      const session = await (await import("@/lib/api-server")).requireSession();
      const body = await req.text();
      const res = await backendFetch("/api/v1/governance/feedback", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json", "X-User-Id": session.userId },
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    const backendPath = ROUTE_MAP[key];
    if (!backendPath) return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
    return proxy(req, backendPath);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await ctx.params;
    if (path[0] === "alerts" && path[1]) {
      await requireManagementSession();
      const body = await req.text();
      const res = await backendFetch(`/api/v1/governance/alerts/${path[1]}`, {
        method: "PATCH",
        body,
        headers: { "Content-Type": "application/json" },
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
  } catch (e) {
    return handleError(e);
  }
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
