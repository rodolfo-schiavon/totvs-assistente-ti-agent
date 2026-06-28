import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clientContextHeaders, requireSession, agentBase, backendFetch } from "@/lib/api-server";
import { SESSION_COOKIE } from "@/lib/auth";

async function ensureConversation(
  conversationId: string | null | undefined,
  message: string,
  clientHeaders: Record<string, string>
): Promise<string> {
  if (conversationId) {
    const check = await backendFetch(`/api/v1/agent/conversations/${conversationId}`, {
      headers: clientHeaders,
    });
    if (!check.ok) {
      const err = await check.json().catch(() => ({}));
      throw new Error(err.error || "Conversa não encontrada ou sem permissão.");
    }
    return conversationId;
  }

  const create = await backendFetch("/api/v1/agent/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...clientHeaders },
    body: JSON.stringify({ title: message.slice(0, 56) }),
  });
  const created = await create.json().catch(() => ({}));
  if (!create.ok || !created.id) {
    const detail =
      typeof created.error === "string"
        ? created.error
        : create.status === 401
          ? "Sessão inválida — faça login novamente."
          : "Não foi possível criar conversa";
    throw new Error(detail);
  }
  return created.id as string;
}

async function saveMessage(
  conversationId: string,
  role: string,
  content: unknown,
  clientHeaders: Record<string, string>,
  extra?: { usage?: unknown; titleHint?: string }
): Promise<{ id: string; createdAt: string }> {
  const res = await backendFetch(`/api/v1/agent/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...clientHeaders },
    body: JSON.stringify({ role, content, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Falha ao salvar mensagem");
  return { id: data.id, createdAt: data.createdAt };
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const message = String(body.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const clientHeaders = clientContextHeaders(req);
    const convId = await ensureConversation(body.conversationId, message, clientHeaders);
    const userMsg = await saveMessage(convId, "user", message, clientHeaders, { titleHint: message });

    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;

    const res = await fetch(`${agentBase()}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-User-Id": session.userId,
        "X-User-Role": session.role,
      },
      body: JSON.stringify({
        message,
        conversation_id: convId,
        session_input_tokens: body.sessionInputTokens ?? 0,
        session_output_tokens: body.sessionOutputTokens ?? 0,
        session_cost_usd: body.sessionCostUsd ?? 0,
        session_turns: body.sessionTurns ?? 0,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || "Erro no agente", conversation_id: convId },
        { status: res.status }
      );
    }

    const assistantMsg = await saveMessage(convId, "assistant", data.response, clientHeaders, {
      usage: data.usage,
    });

    return NextResponse.json({
      ...data,
      conversation_id: convId,
      user_message_id: userMsg.id,
      assistant_message_id: assistantMsg.id,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const msg = e instanceof Error ? e.message : "Falha ao contactar agente";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
