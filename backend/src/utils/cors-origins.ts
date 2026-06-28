/** Origens permitidas para CORS (domínio público + extras opcionais). */
export function resolveCorsOrigins(): string[] {
  const origins = new Set<string>(["http://localhost:3000"]);
  const primary = process.env.FRONTEND_URL?.trim().replace(/\/$/, "");
  if (primary) origins.add(primary);
  const extra = process.env.ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  for (const o of extra ?? []) origins.add(o);
  return [...origins];
}
