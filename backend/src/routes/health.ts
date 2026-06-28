import type { FastifyInstance } from "fastify";
import { getStorageInfo } from "../knowledge/storage";
import { resolveAiAgentUrl } from "../knowledge/vfs-notify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/v1/health", async () => {
    const storage = await getStorageInfo();
    return {
      status: "ok",
      service: "assistente-ti-api",
      timestamp: new Date().toISOString(),
      storage,
      aiAgentUrl: resolveAiAgentUrl() || null,
    };
  });
}
