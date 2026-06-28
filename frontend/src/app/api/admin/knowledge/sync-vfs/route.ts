import { NextResponse } from "next/server";
import { backendFetch, requireManagementSession } from "@/lib/api-server";

export async function POST() {
  try {
    await requireManagementSession();
    const res = await backendFetch("/api/v1/knowledge/sync-vfs", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: data.error || "Erro" }, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao sincronizar VFS" }, { status: 500 });
  }
}
