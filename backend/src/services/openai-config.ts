import { prisma } from "../db";
import { decryptSecret } from "./encryption";

export type OpenAiRuntimeConfig = {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
};

async function getOpenAiRow() {
  return prisma.llmProviderConfig.findFirst({
    where: { provider: "openai", active: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function resolveOpenAiConfig(): Promise<OpenAiRuntimeConfig | null> {
  const envKey = process.env.OPENAI_API_KEY || process.env.EMBEDDING_API_KEY;
  const envModel = process.env.OPENAI_PDF_MODEL || process.env.VISION_MODEL || "gpt-4o-mini";
  const envMaxOut = parseInt(process.env.OPENAI_PDF_MAX_OUTPUT_TOKENS || "16384", 10);

  const row = await getOpenAiRow();
  if (row) {
    const apiKey = decryptSecret(row.apiKeyEnc);
    return {
      apiKey,
      model: process.env.OPENAI_PDF_MODEL || row.model,
      maxOutputTokens:
        parseInt(process.env.OPENAI_PDF_MAX_OUTPUT_TOKENS || "", 10) ||
        row.maxTokens ||
        16384,
    };
  }

  if (envKey?.trim()) {
    return {
      apiKey: envKey.trim(),
      model: envModel,
      maxOutputTokens: Number.isFinite(envMaxOut) ? envMaxOut : 16384,
    };
  }

  return null;
}

export async function hydrateOpenAiRuntimeEnv(): Promise<void> {
  const cfg = await resolveOpenAiConfig();
  if (!cfg) return;
  process.env.OPENAI_API_KEY = cfg.apiKey;
  if (!process.env.OPENAI_PDF_MODEL) {
    process.env.OPENAI_PDF_MODEL = cfg.model;
  }
  if (!process.env.VISION_MODEL) {
    process.env.VISION_MODEL = cfg.model;
  }
}

export function visionModelFromConfig(cfg: OpenAiRuntimeConfig): string {
  return process.env.VISION_MODEL || cfg.model;
}
