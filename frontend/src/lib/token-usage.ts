export type TokenUsageSource = "provider" | "estimated";

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  model: string;
  provider: string;
  source: TokenUsageSource;
  llm_calls?: number;
  estimated_cost_usd: number;
}

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatCostUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.0001) return "< $0.0001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

export function usageSourceLabel(source: TokenUsageSource): string {
  return source === "provider" ? "contagem do provedor" : "estimativa";
}
