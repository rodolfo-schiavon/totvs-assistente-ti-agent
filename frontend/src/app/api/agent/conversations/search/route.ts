import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireSession } from "@/lib/api-server";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const q = req.nextUrl.searchParams.get("q") || "";
    const limit = req.nextUrl.searchParams.get("limit") || "30";
    const res = await backendFetch(
      `/api/v1/agent/conversations/search?q=${encodeURIComponent(q)}&limit=${limit}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.error || "Erro na busca" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha na busca" }, { status: 500 });
  }
}
