import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/api-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await backendFetch("/api/v1/consent/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body || "{}",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Falha ao registrar consentimento." }, { status: 500 });
  }
}
