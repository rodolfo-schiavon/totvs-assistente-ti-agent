import { NextRequest, NextResponse } from "next/server";
import { backendFetch, requireManagementSession } from "@/lib/api-server";

export async function GET(req: NextRequest) {
  try {
    await requireManagementSession();
    const days = req.nextUrl.searchParams.get("days") || "30";
    const res = await backendFetch(`/api/v1/management/reports/usage?days=${days}`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}
