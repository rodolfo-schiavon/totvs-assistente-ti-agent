import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireManagementSession } from "@/lib/api-server";

export async function GET(req: NextRequest) {
  try {
    await requireManagementSession();
    const q = req.nextUrl.searchParams.get("q") || "";
    const limit = req.nextUrl.searchParams.get("limit") || "50";
    const res = await backendFetch(
      `/api/v1/knowledge/documents/search?q=${encodeURIComponent(q)}&limit=${limit}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: data.error || "Erro" }, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha na busca" }, { status: 500 });
  }
}
