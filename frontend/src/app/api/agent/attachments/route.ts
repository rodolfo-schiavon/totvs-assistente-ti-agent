import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireSession } from "@/lib/api-server";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const form = await req.formData();
    const file = form.get("file");
    const conversationId = form.get("conversationId");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }

    const fd = new FormData();
    fd.append("file", file, (file as File).name || "anexo");
    if (conversationId) fd.append("conversationId", String(conversationId));

    const res = await backendFetch("/api/v1/agent/attachments", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: data.error || "Erro no upload" }, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha no upload" }, { status: 500 });
  }
}
