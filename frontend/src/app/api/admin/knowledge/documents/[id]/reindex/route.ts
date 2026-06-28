import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireManagementSession } from "@/lib/api-server";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await requireManagementSession();
    const { id } = await params;
    const res = await backendFetch(`/api/v1/knowledge/documents/${id}/reindex`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: data.error || "Erro" }, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao reindexar" }, { status: 500 });
  }
}
