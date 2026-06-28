import { NextRequest, NextResponse } from "next/server";
import { backendFetch, clientContextHeaders, requireSession } from "@/lib/api-server";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  await requireSession();
  const { id } = await params;
  const res = await backendFetch(`/api/v1/agent/actions/${id}/reject`, {
    method: "POST",
    headers: clientContextHeaders(request),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
