import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireSession } from "@/lib/api-server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const res = await backendFetch(`/api/v1/agent/attachments/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: data.error || "Erro" }, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao consultar anexo" }, { status: 500 });
  }
}
