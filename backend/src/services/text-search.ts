/** Extrai trecho de texto em torno do termo buscado. */
export function extractSnippet(text: string, query: string, maxLen = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return normalized.slice(0, maxLen);

  const idx = lower.indexOf(q);
  if (idx === -1) return normalized.slice(0, maxLen);

  const start = Math.max(0, idx - 50);
  const end = Math.min(normalized.length, idx + q.length + 90);
  let snippet = normalized.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < normalized.length) snippet = `${snippet}…`;
  return snippet.length > maxLen ? `${snippet.slice(0, maxLen)}…` : snippet;
}

export function messagePlainText(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed === "string") return parsed;
    if (typeof parsed.markdown === "string") return parsed.markdown;
    if (parsed.type === "mixed_response" && typeof parsed.markdown === "string") {
      return parsed.markdown;
    }
  } catch {
    /* texto bruto */
  }
  return raw;
}
