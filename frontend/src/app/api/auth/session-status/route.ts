import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/api-server";

export async function GET() {
  try {
    const res = await backendFetch("/api/v1/auth/session-status");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}
