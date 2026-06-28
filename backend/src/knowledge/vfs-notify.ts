import { resolveAiAgentUrlFromEnv } from "../utils/service-url";

const AGENT_SECRET = process.env.AGENT_SERVICE_SECRET || "";

/** Resolve URL do ai-agent (env explícita ou referência Railway). */
export function resolveAiAgentUrl(): string {
  return resolveAiAgentUrlFromEnv();
}

export type VfsSyncNotifyResult = {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
};

export async function notifyVfsSync(): Promise<VfsSyncNotifyResult> {
  const aiAgentUrl = resolveAiAgentUrl();
  if (!aiAgentUrl) {
    const msg =
      "AI_AGENT_URL não configurado no backend — documentos não serão sincronizados com o VFS. " +
      "Defina https://${{ai-agent.RAILWAY_PUBLIC_DOMAIN}}";
    console.error(msg);
    return { ok: false, error: msg };
  }
  try {
    const res = await fetch(`${aiAgentUrl}/v1/kb/sync?wait=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AGENT_SECRET ? { "X-Agent-Secret": AGENT_SECRET } : {}),
      },
      signal: AbortSignal.timeout(120_000),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("notifyVfsSync failed:", res.status, body);
      return { ok: false, status: res.status, body, error: body.slice(0, 500) };
    }
    console.info("notifyVfsSync ok:", body.slice(0, 200));
    return { ok: true, status: res.status, body };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("notifyVfsSync error:", msg);
    return { ok: false, error: msg };
  }
}
