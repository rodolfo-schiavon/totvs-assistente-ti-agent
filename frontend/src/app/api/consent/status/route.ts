import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/api-server";

export async function GET() {
  try {
    const res = await backendFetch("/api/v1/consent/status");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ accepted: false, consentVersion: "1.0" });
  }
}
