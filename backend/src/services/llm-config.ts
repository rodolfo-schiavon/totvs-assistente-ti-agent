import { LlmEnvironment, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { decryptSecret, encryptSecret, maskSecret } from "./encryption";
import { hydrateOpenAiRuntimeEnv } from "./openai-config";

export const ALLOWED_LLM_PROVIDERS = ["openai", "anthropic"] as const;
export type AllowedLlmProvider = (typeof ALLOWED_LLM_PROVIDERS)[number];

/** Limite padrão de saída do chat jurídico (contratos/minutas exigem muito mais que 4k). */
export const DEFAULT_CHAT_MAX_TOKENS = 16384;

/** Modelos aposentados pela Anthropic — migrados automaticamente no startup. */
export const RETIRED_MODEL_MAP: Record<string, string> = {
  "claude-3-5-haiku-20241022": "claude-haiku-4-5-20251001",
  "claude-3-5-sonnet-20241022": "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-20250514": "claude-sonnet-4-5-20250929",
  "claude-3-haiku-20240307": "claude-haiku-4-5-20251001",
};

export function normalizeProvider(provider: string): string {
  return provider.toLowerCase().trim();
}

export function isAllowedProvider(provider: string): provider is AllowedLlmProvider {
  const p = normalizeProvider(provider);
  if (p.includes("google") || p.includes("gemini")) return false;
  return ALLOWED_LLM_PROVIDERS.includes(p as AllowedLlmProvider);
}

export function assertAllowedProvider(provider: string): AllowedLlmProvider {
  const p = normalizeProvider(provider);
  if (p.includes("google") || p.includes("gemini")) {
    throw new Error("Provedor Google/Gemini não é mais suportado neste projeto.");
  }
  if (!ALLOWED_LLM_PROVIDERS.includes(p as AllowedLlmProvider)) {
    throw new Error(`Provedor inválido: ${provider}. Use openai ou anthropic.`);
  }
  return p as AllowedLlmProvider;
}

export function maskConfig<T extends { apiKeyEnc: string }>(row: T) {
  let masked = "****";
  try {
    masked = maskSecret(decryptSecret(row.apiKeyEnc));
  } catch {
    /* keep default */
  }
  const { apiKeyEnc: _, ...rest } = row;
  return { ...rest, apiKeyMasked: masked };
}

export async function listLlmConfigs() {
  const rows = await prisma.llmProviderConfig.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(maskConfig);
}

export async function getProviderConfig(provider: AllowedLlmProvider) {
  return prisma.llmProviderConfig.findFirst({
    where: { provider, active: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getOpenAiProviderConfig() {
  return getProviderConfig("openai");
}

export async function getChatLlmConfig() {
  return getProviderConfig("anthropic");
}

/** @deprecated Use getChatLlmConfig() — mantido para compatibilidade interna. */
export async function getActiveLlmConfig() {
  return getChatLlmConfig();
}

export async function getFallbackConfigs() {
  return prisma.llmProviderConfig.findMany({
    where: { active: true, isFallback: true },
    orderBy: { updatedAt: "desc" },
  });
}

export type LlmConfigInput = {
  provider: string;
  displayName: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  organizationId?: string;
  projectId?: string;
  deploymentName?: string;
  temperature?: number;
  maxTokens?: number;
  isDefault?: boolean;
  isFallback?: boolean;
  environment?: LlmEnvironment;
  active?: boolean;
};

function defaultDisplayName(provider: AllowedLlmProvider): string {
  return provider === "openai" ? "OpenAI — Extração" : "Anthropic — Agente jurídico";
}

export async function createLlmConfig(data: LlmConfigInput, userId?: string) {
  const provider = assertAllowedProvider(data.provider);
  if (data.isDefault) {
    await prisma.llmProviderConfig.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
  }
  const row = await prisma.llmProviderConfig.create({
    data: {
      provider,
      displayName: data.displayName || defaultDisplayName(provider),
      model: data.model,
      apiKeyEnc: encryptSecret(data.apiKey),
      baseUrl: data.baseUrl || null,
      organizationId: data.organizationId || null,
      projectId: data.projectId || null,
      deploymentName: data.deploymentName || null,
      temperature: data.temperature ?? 0.2,
      maxTokens: data.maxTokens ?? DEFAULT_CHAT_MAX_TOKENS,
      isDefault: provider === "anthropic" ? (data.isDefault ?? true) : false,
      isFallback: data.isFallback ?? false,
      environment: data.environment ?? LlmEnvironment.production,
      active: data.active ?? true,
    },
  });
  await prisma.llmConfigAuditLog.create({
    data: { configId: row.id, userId, action: "create", details: row.displayName },
  });
  if (provider === "openai") await hydrateOpenAiRuntimeEnv();
  return maskConfig(row);
}

export async function updateLlmConfig(
  id: string,
  data: Partial<Omit<LlmConfigInput, "baseUrl"> & { baseUrl?: string | null }>,
  userId?: string
) {
  if (data.provider) assertAllowedProvider(data.provider);
  if (data.isDefault) {
    await prisma.llmProviderConfig.updateMany({ data: { isDefault: false }, where: { isDefault: true, NOT: { id } } });
  }
  const patch: Prisma.LlmProviderConfigUpdateInput = { ...data };
  if (data.provider) patch.provider = assertAllowedProvider(data.provider);
  if (data.apiKey) patch.apiKeyEnc = encryptSecret(data.apiKey);
  delete (patch as { apiKey?: string }).apiKey;
  const row = await prisma.llmProviderConfig.update({ where: { id }, data: patch });
  await prisma.llmConfigAuditLog.create({
    data: { configId: row.id, userId, action: "update", details: row.displayName },
  });
  if (row.provider === "openai") await hydrateOpenAiRuntimeEnv();
  return maskConfig(row);
}

export async function upsertLlmConfigByProvider(
  providerInput: string,
  data: {
    displayName?: string;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
    active?: boolean;
  },
  userId?: string
) {
  const provider = assertAllowedProvider(providerInput);
  const existing = await prisma.llmProviderConfig.findUnique({ where: { provider } });

  if (existing) {
    const patch: Partial<LlmConfigInput> = {
      displayName: data.displayName || existing.displayName,
      model: data.model,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      active: data.active ?? true,
    };
    if (data.apiKey?.trim()) patch.apiKey = data.apiKey.trim();
    return updateLlmConfig(existing.id, patch, userId);
  }

  if (!data.apiKey?.trim()) {
    throw new Error("API Key é obrigatória na primeira configuração deste provedor.");
  }

  return createLlmConfig(
    {
      provider,
      displayName: data.displayName || defaultDisplayName(provider),
      model: data.model,
      apiKey: data.apiKey.trim(),
      baseUrl: data.baseUrl,
      temperature: data.temperature ?? 0.2,
      maxTokens: data.maxTokens ?? DEFAULT_CHAT_MAX_TOKENS,
      isDefault: provider === "anthropic",
      active: data.active ?? true,
    },
    userId
  );
}

export async function deleteLlmConfig(id: string, userId?: string) {
  const row = await prisma.llmProviderConfig.findUnique({ where: { id } });
  await prisma.llmConfigAuditLog.create({
    data: { configId: id, userId, action: "delete" },
  });
  await prisma.llmProviderConfig.delete({ where: { id } });
  if (row?.provider === "openai") await hydrateOpenAiRuntimeEnv();
}

export async function testLlmConnection(config: {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const provider = config.provider.toLowerCase();
  try {
    if (provider.includes("google") || config.model.toLowerCase().includes("gemini")) {
      return { ok: false, message: "Provedor Google/Gemini não é mais suportado." };
    }
    if (provider.includes("openai") || provider === "groq") {
      const base = config.baseUrl || (provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1");
      const res = await fetch(`${base.replace(/\/$/, "")}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      return { ok: true, message: "Conexão OK" };
    }
    if (provider.includes("anthropic")) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 401) return { ok: false, message: "Chave inválida" };
      if (res.status === 404) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: { type?: string; message?: string } };
          if (body.error?.type === "not_found_error") {
            return {
              ok: false,
              message: `Modelo não encontrado ou aposentado (${config.model}). Selecione outro em Admin → LLM.`,
            };
          }
          detail = body.error?.message || "";
        } catch {
          /* ignore */
        }
        return {
          ok: false,
          message: detail
            ? `Modelo indisponível: ${detail}`
            : "Modelo não encontrado ou aposentado. Selecione outro no catálogo.",
        };
      }
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      return { ok: true, message: "Conexão OK" };
    }
    return { ok: true, message: "Provedor não validado automaticamente; credencial salva." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erro de conexão" };
  }
}

export function toDecryptedActive(row: NonNullable<Awaited<ReturnType<typeof getChatLlmConfig>>>) {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.displayName,
    model: row.model,
    apiKey: decryptSecret(row.apiKeyEnc),
    baseUrl: row.baseUrl,
    organizationId: row.organizationId,
    projectId: row.projectId,
    deploymentName: row.deploymentName,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    environment: row.environment,
  };
}

/** Sobe maxTokens de configs Anthropic ainda no default legado (4096). */
export async function migrateLowMaxTokens(): Promise<number> {
  const rows = await prisma.llmProviderConfig.findMany({
    where: { provider: "anthropic", maxTokens: { lte: 4096 } },
  });
  let migrated = 0;
  for (const row of rows) {
    await prisma.llmProviderConfig.update({
      where: { id: row.id },
      data: { maxTokens: DEFAULT_CHAT_MAX_TOKENS },
    });
    await prisma.llmConfigAuditLog.create({
      data: {
        configId: row.id,
        action: "migrate_low_max_tokens",
        details: `${row.maxTokens} → ${DEFAULT_CHAT_MAX_TOKENS}`,
      },
    });
    migrated += 1;
  }
  return migrated;
}

export async function migrateRetiredLlmModels(): Promise<number> {
  const rows = await prisma.llmProviderConfig.findMany();
  let migrated = 0;
  for (const row of rows) {
    const replacement = RETIRED_MODEL_MAP[row.model];
    if (!replacement || replacement === row.model) continue;
    await prisma.llmProviderConfig.update({
      where: { id: row.id },
      data: { model: replacement },
    });
    await prisma.llmConfigAuditLog.create({
      data: {
        configId: row.id,
        action: "migrate_retired_model",
        details: `${row.model} → ${replacement}`,
      },
    });
    migrated += 1;
  }
  return migrated;
}

export async function cleanupLegacyLlmConfigs() {
  await prisma.llmProviderConfig.deleteMany({
    where: {
      OR: [
        { provider: { contains: "google", mode: "insensitive" } },
        { provider: { contains: "gemini", mode: "insensitive" } },
        { model: { contains: "gemini", mode: "insensitive" } },
      ],
    },
  });

  const dupes = await prisma.llmProviderConfig.groupBy({
    by: ["provider"],
    _count: { provider: true },
    having: { provider: { _count: { gt: 1 } } },
  });

  for (const d of dupes) {
    const rows = await prisma.llmProviderConfig.findMany({
      where: { provider: d.provider },
      orderBy: { updatedAt: "desc" },
    });
    for (const row of rows.slice(1)) {
      await prisma.llmProviderConfig.delete({ where: { id: row.id } });
    }
  }
}

export async function ensureLlmProviderUniqueIndex() {
  await cleanupLegacyLlmConfigs();
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "LlmProviderConfig_provider_key"
    ON "LlmProviderConfig"("provider");
  `);
}
