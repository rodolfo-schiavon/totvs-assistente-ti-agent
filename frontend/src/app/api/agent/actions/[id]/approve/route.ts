import { NextRequest, NextResponse } from "next/server";
import { backendFetch, clientContextHeaders, requireSession } from "@/lib/api-server";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;
  const res = await backendFetch(`/api/v1/agent/actions/${id}/approve`, {
    method: "POST",
    headers: clientContextHeaders(session),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
