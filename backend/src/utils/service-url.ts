/** Normaliza URL de serviço Railway / env para fetch server-side. */
export function normalizeServiceUrl(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  let v = raw.trim().replace(/\/$/, "");
  if (v.endsWith(":")) return null;
  if (!v.startsWith("http")) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!u.hostname) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function resolveAiAgentUrlFromEnv(): string {
  const candidates = [
    process.env.AI_AGENT_URL,
    process.env.AI_AGENT_INTERNAL_URL,
    process.env.RAILWAY_SERVICE_AI_AGENT_URL,
  ];
  for (const raw of candidates) {
    const url = normalizeServiceUrl(raw);
    if (url) return url;
  }
  return "";
}
