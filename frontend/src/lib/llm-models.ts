export type LlmProviderId = "openai" | "anthropic";

export type ModelTier = "economy" | "balanced" | "premium";

export interface ModelOption {
  id: string;
  label: string;
  provider: LlmProviderId;
  /** USD por 1M tokens de entrada */
  inputUsdPer1M: number;
  /** USD por 1M tokens de saída */
  outputUsdPer1M: number;
  contextK: number;
  tier: ModelTier;
  description: string;
}

/** Referência de preços públicos (USD/1M tokens). Atualize conforme o provedor. */
export const MODEL_CATALOG: ModelOption[] = [
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    contextK: 128,
    tier: "economy",
    description: "Recomendado para extração de PDF, OCR e alto volume.",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 10,
    contextK: 128,
    tier: "balanced",
    description: "Maior fidelidade em PDFs complexos e tabelas densas.",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    provider: "openai",
    inputUsdPer1M: 0.4,
    outputUsdPer1M: 1.6,
    contextK: 128,
    tier: "economy",
    description: "Alternativa rápida para extração documental.",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    inputUsdPer1M: 2.0,
    outputUsdPer1M: 8.0,
    contextK: 128,
    tier: "premium",
    description: "Extração avançada quando precisão > custo.",
  },
  {
    id: "claude-sonnet-4-5-20250929",
    label: "Claude Sonnet 4.5",
    provider: "anthropic",
    inputUsdPer1M: 3.0,
    outputUsdPer1M: 15.0,
    contextK: 200,
    tier: "balanced",
    description: "Recomendado para análise jurídica, contratos e minutas.",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    inputUsdPer1M: 3.0,
    outputUsdPer1M: 15.0,
    contextK: 200,
    tier: "premium",
    description: "Máxima qualidade para análises jurídicas complexas.",
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    inputUsdPer1M: 1.0,
    outputUsdPer1M: 5.0,
    contextK: 200,
    tier: "economy",
    description: "Rápido para revisões e resumos de alto volume.",
  },
];

export function modelsForProvider(provider: LlmProviderId): ModelOption[] {
  return MODEL_CATALOG.filter((m) => m.provider === provider);
}

export function findModel(modelId: string): ModelOption | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}

export function formatUsdPer1M(value: number): string {
  if (value < 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(2)}`;
}

export function tierLabel(tier: ModelTier): string {
  if (tier === "economy") return "Econômico";
  if (tier === "balanced") return "Equilibrado";
  return "Premium";
}

export const PROVIDER_SLOTS: {
  id: LlmProviderId;
  label: string;
  role: string;
  description: string;
  defaultModel: string;
  keyPlaceholder: string;
}[] = [
  {
    id: "openai",
    label: "OpenAI",
    role: "Extração de documentos",
    description: "PDF (OCR), imagens, transcrição de áudio/vídeo e ingestão na base de conhecimento.",
    defaultModel: "gpt-4o-mini",
    keyPlaceholder: "sk-...",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    role: "Agente jurídico",
    description: "Chat, análises jurídicas e respostas do agente LangGraph.",
    defaultModel: "claude-sonnet-4-5-20250929",
    keyPlaceholder: "sk-ant-...",
  },
];
