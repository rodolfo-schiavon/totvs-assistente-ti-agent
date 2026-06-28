import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/api-server";

export async function GET() {
  try {
    const res = await backendFetch("/api/v1/legal/dashboard");
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao carregar dashboard." }, { status: 500 });
  }
}
