"""Referência de preços USD/1M tokens — espelho do catálogo frontend."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelPricing:
    input_usd_per_1m: float
    output_usd_per_1m: float


PRICING: dict[str, ModelPricing] = {
    "gpt-4o-mini": ModelPricing(0.15, 0.6),
    "gpt-4o": ModelPricing(2.5, 10.0),
    "gpt-4.1-mini": ModelPricing(0.4, 1.6),
    "gpt-4.1": ModelPricing(2.0, 8.0),
    "o3-mini": ModelPricing(1.1, 4.4),
    "claude-sonnet-4-5-20250929": ModelPricing(3.0, 15.0),
    "claude-sonnet-4-6": ModelPricing(3.0, 15.0),
    "claude-haiku-4-5-20251001": ModelPricing(1.0, 5.0),
    # Legado — custo estimado para registros antigos antes da migração automática
    "claude-sonnet-4-20250514": ModelPricing(3.0, 15.0),
    "claude-3-5-sonnet-20241022": ModelPricing(3.0, 15.0),
    "claude-3-5-haiku-20241022": ModelPricing(0.8, 4.0),
}


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    p = PRICING.get(model)
    if not p:
        return 0.0
    return (input_tokens / 1_000_000) * p.input_usd_per_1m + (output_tokens / 1_000_000) * p.output_usd_per_1m
