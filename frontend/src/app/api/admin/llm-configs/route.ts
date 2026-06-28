import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireSession } from "@/lib/api-server";

function authErrorResponse(e: unknown) {
  if (e instanceof Error && e.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { error: "Sessão expirada ou inválida. Faça login novamente." },
      { status: 401 }
    );
  }
  console.error("Admin LLM API error:", e);
  return NextResponse.json({ error: "Erro interno ao processar requisição." }, { status: 500 });
}

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const res = await backendFetch("/api/v1/admin/llm-configs");
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const body = await req.json();
    const res = await backendFetch("/api/v1/admin/llm-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || data.message || "Erro ao salvar configuração" },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return authErrorResponse(e);
  }
}
