import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "legal-ai-workspace-web",
    timestamp: new Date().toISOString(),
  });
}
