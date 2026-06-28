const PLATFORM_OPS_MCP_URL =
  process.env.PLATFORM_OPS_MCP_URL || "http://platform-ops-mcp.platform.svc:8080";

export async function platformInsights(): Promise<Record<string, unknown>> {
  try {
    const r = await fetch(`${PLATFORM_OPS_MCP_URL}/api/v1/tools/recommend_actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!r.ok) {
      return { error: await r.text() };
    }
    return (await r.json()) as Record<string, unknown>;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
