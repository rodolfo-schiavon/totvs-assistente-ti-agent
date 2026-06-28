import os
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI

DEFAULT_MAX_TOKENS = 16384
DOCUMENT_MAX_TOKENS = 16384
DOCUMENT_ANALYSIS_TYPES = frozenset({"criacao_contrato", "minuta", "revisao_juridica"})


def _gateway_enabled() -> bool:
    return bool(os.getenv("LLM_GATEWAY_BASE_URL", "").strip())


def _gateway_base_url() -> str:
    return os.getenv("LLM_GATEWAY_BASE_URL", "").strip().rstrip("/")


def _gateway_api_key() -> str:
    return os.getenv("LLM_GATEWAY_TOKEN", "").strip() or "gateway"


def build_llm(cfg: dict[str, Any], analysis_type: str | None = None):
    provider = cfg.get("provider", "").lower()
    model = cfg.get("model", "claude-sonnet-4-5-20250929")
    api_key = cfg["apiKey"]
    temperature = cfg.get("temperature", 0.2)
    max_tokens = int(cfg.get("maxTokens") or DEFAULT_MAX_TOKENS)

    if analysis_type in DOCUMENT_ANALYSIS_TYPES:
        max_tokens = max(max_tokens, DOCUMENT_MAX_TOKENS)

    if _gateway_enabled():
        # Gateway responde JSON completo (sem SSE OpenAI); streaming=True quebra astream/astream_events.
        return ChatOpenAI(
            model=model,
            api_key=_gateway_api_key(),
            base_url=f"{_gateway_base_url()}/v1",
            temperature=temperature,
            max_tokens=max_tokens,
            streaming=False,
        )

    if "anthropic" not in provider:
        raise RuntimeError(
            f"Provedor '{cfg.get('provider')}' não suportado para chat. "
            "Configure Anthropic no admin de LLM ou LLM_GATEWAY_BASE_URL."
        )

    return ChatAnthropic(model=model, api_key=api_key, temperature=temperature, max_tokens=max_tokens)
