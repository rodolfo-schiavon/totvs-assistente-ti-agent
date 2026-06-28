import type { FastifyInstance } from "fastify";
import { getChatLlmConfig, getFallbackConfigs, toDecryptedActive } from "../services/llm-config";
import { decryptSecret } from "../services/encryption";

export async function internalRoutes(app: FastifyInstance) {
  app.get("/api/v1/internal/llm/active", async (_request, reply) => {
    const active = await getChatLlmConfig();
    if (!active) {
      return reply.code(404).send({
        error: "Anthropic não configurado. Configure o provedor Anthropic no admin de LLM.",
      });
    }
    const fallbacks = await getFallbackConfigs();
    return {
      primary: toDecryptedActive(active),
      fallbacks: fallbacks.map((f) => ({
        id: f.id,
        provider: f.provider,
        model: f.model,
        apiKey: decryptSecret(f.apiKeyEnc),
        baseUrl: f.baseUrl,
        temperature: f.temperature,
        maxTokens: f.maxTokens,
      })),
    };
  });
}
