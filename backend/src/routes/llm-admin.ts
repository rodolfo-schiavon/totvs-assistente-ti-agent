import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { requireAdmin } from "../middleware/auth";
import {
  assertAllowedProvider,
  deleteLlmConfig,
  listLlmConfigs,
  testLlmConnection,
  updateLlmConfig,
  upsertLlmConfigByProvider,
  DEFAULT_CHAT_MAX_TOKENS,
  type LlmConfigInput,
} from "../services/llm-config";
import { decryptSecret } from "../services/encryption";

export async function llmAdminRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/llm-configs", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    return { configs: await listLlmConfigs() };
  });

  app.put("/api/v1/admin/llm-configs/by-provider/:provider", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { provider } = request.params as { provider: string };
    const body = request.body as Record<string, unknown>;
    try {
      assertAllowedProvider(provider);
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "Provedor inválido" });
    }
    if (!body.model) {
      return reply.code(400).send({ error: "Campo model é obrigatório" });
    }
    try {
      const config = await upsertLlmConfigByProvider(
        provider,
        {
          displayName: body.displayName ? String(body.displayName) : undefined,
          model: String(body.model),
          apiKey: body.apiKey ? String(body.apiKey) : undefined,
          baseUrl: body.baseUrl ? String(body.baseUrl) : undefined,
          temperature: body.temperature !== undefined ? Number(body.temperature) : undefined,
          maxTokens: body.maxTokens !== undefined ? Number(body.maxTokens) : undefined,
          active: body.active !== false,
        },
        request.auth?.userId
      );
      return config;
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "Erro ao salvar configuração" });
    }
  });

  app.post("/api/v1/admin/llm-configs", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const body = request.body as Record<string, unknown>;
    if (!body.provider || !body.displayName || !body.model || !body.apiKey) {
      return reply.code(400).send({ error: "Campos obrigatórios: provider, displayName, model, apiKey" });
    }
    try {
      assertAllowedProvider(String(body.provider));
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "Provedor inválido" });
    }
    try {
      const config = await upsertLlmConfigByProvider(
        String(body.provider),
        {
          displayName: body.displayName ? String(body.displayName) : undefined,
          model: String(body.model),
          apiKey: String(body.apiKey),
          baseUrl: body.baseUrl ? String(body.baseUrl) : undefined,
          temperature: Number(body.temperature) || 0.2,
          maxTokens: Number(body.maxTokens) || DEFAULT_CHAT_MAX_TOKENS,
          active: body.active !== false,
        },
        request.auth?.userId
      );
      return config;
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "Erro ao salvar" });
    }
  });

  app.patch("/api/v1/admin/llm-configs/:id", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const patch: Partial<Omit<LlmConfigInput, "baseUrl"> & { baseUrl?: string | null }> = {};
    if (body.provider) {
      try {
        patch.provider = assertAllowedProvider(String(body.provider));
      } catch (e) {
        return reply.code(400).send({ error: e instanceof Error ? e.message : "Provedor inválido" });
      }
    }
    if (body.displayName) patch.displayName = String(body.displayName);
    if (body.model) patch.model = String(body.model);
    if (body.apiKey) patch.apiKey = String(body.apiKey);
    if (body.baseUrl !== undefined) patch.baseUrl = body.baseUrl ? String(body.baseUrl) : null;
    if (body.temperature !== undefined) patch.temperature = Number(body.temperature);
    if (body.maxTokens !== undefined) patch.maxTokens = Number(body.maxTokens);
    if (body.isDefault !== undefined) patch.isDefault = Boolean(body.isDefault);
    if (body.isFallback !== undefined) patch.isFallback = Boolean(body.isFallback);
    if (body.active !== undefined) patch.active = Boolean(body.active);
    if (body.environment) patch.environment = body.environment as import("@prisma/client").LlmEnvironment;
    return updateLlmConfig(id, patch, request.auth?.userId);
  });

  app.delete("/api/v1/admin/llm-configs/:id", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    await deleteLlmConfig(id, request.auth?.userId);
    return { ok: true };
  });

  app.post("/api/v1/admin/llm-configs/:id/test-connection", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const row = await prisma.llmProviderConfig.findUnique({ where: { id } });
    if (!row) return reply.code(404).send({ error: "Config não encontrada" });
    const body = request.body as { apiKey?: string };
    const apiKey = body.apiKey || decryptSecret(row.apiKeyEnc);
    return testLlmConnection({
      provider: row.provider,
      model: row.model,
      apiKey,
      baseUrl: row.baseUrl,
    });
  });

  app.post("/api/v1/admin/llm-configs/test-connection", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const body = request.body as { provider?: string; model?: string; apiKey?: string; baseUrl?: string };
    if (!body.provider || !body.model || !body.apiKey) {
      return reply.code(400).send({ error: "provider, model e apiKey são obrigatórios" });
    }
    try {
      assertAllowedProvider(body.provider);
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "Provedor inválido" });
    }
    return testLlmConnection({
      provider: body.provider,
      model: body.model,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
    });
  });
}
