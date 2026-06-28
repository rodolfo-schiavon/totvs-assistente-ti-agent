import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { clientContextHeaders, requireSession, agentBase, backendFetch } from "@/lib/api-server";
import { SESSION_COOKIE } from "@/lib/auth";

function formatAgentError(raw: unknown): string {
  const text = String(raw || "").trim();
  if (!text) return "Erro no agente";
  const low = text.toLowerCase();
  if (low.includes("not_found_error") || (low.includes("404") && low.includes("model:"))) {
    const modelMatch = text.match(/model:\s*([^\s"'}\]]+)/);
    const modelId = modelMatch?.[1];
    if (modelId) {
      return `O modelo configurado (${modelId}) não está mais disponível. Peça ao administrador para atualizar em Admin → LLM.`;
    }
    return "O modelo de IA configurado não está mais disponível. Atualize em Admin → LLM.";
  }
  return text.slice(0, 500);
}

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
  if (!create.ok || !created.id) throw new Error(created.error || "Não foi possível criar conversa");
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
      return new Response(JSON.stringify({ error: "Mensagem vazia" }), { status: 400 });
    }

    const clientHeaders = clientContextHeaders(req);
    const convId = await ensureConversation(body.conversationId, message, clientHeaders);
    const userMsg = await saveMessage(convId, "user", message, clientHeaders, { titleHint: message });

    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        send({
          type: "meta",
          conversation_id: convId,
          user_message_id: userMsg.id,
        });

        try {
          const res = await fetch(`${agentBase()}/v1/chat/stream`, {
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
              knowledge_mode: body.knowledgeMode ?? false,
              analysis_type: body.analysisType ?? "geral",
              attachment_ids: body.attachmentIds ?? [],
              session_input_tokens: body.sessionInputTokens ?? 0,
              session_output_tokens: body.sessionOutputTokens ?? 0,
              session_cost_usd: body.sessionCostUsd ?? 0,
              session_turns: body.sessionTurns ?? 0,
            }),
            signal: AbortSignal.timeout(360_000),
          });

          if (!res.ok || !res.body) {
            const err = await res.json().catch(() => ({}));
            send({ type: "error", error: formatAgentError(err.detail || err.error || "Erro no agente") });
            controller.close();
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let finalResponse: unknown = null;
          let usage: unknown = null;
          let sessionUsage: unknown = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (!payload) continue;
              try {
                const evt = JSON.parse(payload);
                if (evt.type === "token") send(evt);
                if (evt.type === "done") {
                  finalResponse = evt.response;
                  usage = evt.usage;
                  sessionUsage = evt.session_usage;
                }
                if (evt.type === "error") send({ ...evt, error: formatAgentError(evt.error) });
              } catch {
                /* skip */
              }
            }
          }

          if (!finalResponse) {
            send({
              type: "error",
              error:
                "O agente encerrou sem concluir a resposta. Tente novamente com uma pergunta mais específica ou use o botão Parar e reenvie.",
            });
          } else {
            const assistantMsg = await saveMessage(convId, "assistant", finalResponse, clientHeaders, {
              usage: usage as object | undefined,
            });
            send({
              type: "done",
              conversation_id: convId,
              user_message_id: userMsg.id,
              assistant_message_id: assistantMsg.id,
              response: finalResponse,
              usage,
              session_usage: sessionUsage,
            });
          }
        } catch (e) {
          send({ type: "error", error: formatAgentError(e instanceof Error ? e.message : "Falha no agente") });
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500 });
  }
}
