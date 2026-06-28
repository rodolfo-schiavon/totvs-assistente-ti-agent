import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireSession } from "@/lib/api-server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const res = await backendFetch(`/api/v1/agent/attachments/${id}/file`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ error: data.error || "Anexo não encontrado" }, { status: res.status });
    }
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    return new NextResponse(buffer, { headers: { "Content-Type": contentType } });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao carregar anexo" }, { status: 500 });
  }
}
