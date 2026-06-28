from __future__ import annotations

import json
from typing import Any, Literal

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage

from services.model_pricing import estimate_cost_usd

UsageSource = Literal["provider", "estimated"]


def _text_len(content: Any) -> int:
    if content is None:
        return 0
    if isinstance(content, str):
        return len(content)
    if isinstance(content, list):
        return sum(_text_len(c) for c in content)
    if isinstance(content, dict):
        return len(json.dumps(content, ensure_ascii=False))
    return len(str(content))


def _estimate_tokens(text_chars: int) -> int:
    """Heurística conservadora ~4 chars/token (PT/EN misto)."""
    return max(1, (text_chars + 3) // 4)


def _from_usage_metadata(meta: dict[str, Any]) -> tuple[int, int]:
    inp = int(meta.get("input_tokens") or meta.get("prompt_tokens") or 0)
    out = int(meta.get("output_tokens") or meta.get("completion_tokens") or 0)
    if not inp and not out:
        total = int(meta.get("total_tokens") or 0)
        if total:
            out = total // 3
            inp = total - out
    return inp, out


def _extract_from_ai_message(msg: AIMessage) -> tuple[int, int]:
    inp, out = 0, 0
    usage = getattr(msg, "usage_metadata", None)
    if isinstance(usage, dict):
        inp, out = _from_usage_metadata(usage)
    if inp or out:
        return inp, out
    rm = getattr(msg, "response_metadata", None) or {}
    if isinstance(rm, dict):
        tu = rm.get("token_usage") or rm.get("usage") or {}
        if isinstance(tu, dict):
            inp, out = _from_usage_metadata(tu)
        um = rm.get("usage_metadata")
        if isinstance(um, dict) and not (inp or out):
            inp, out = _from_usage_metadata(um)
    return inp, out


def _estimate_messages_tokens(messages: list[BaseMessage]) -> tuple[int, int]:
    input_chars = 0
    output_chars = 0
    for msg in messages:
        chars = _text_len(getattr(msg, "content", ""))
        if isinstance(msg, (HumanMessage, SystemMessage, ToolMessage)):
            input_chars += chars
        elif isinstance(msg, AIMessage):
            output_chars += chars
            if getattr(msg, "tool_calls", None):
                input_chars += len(json.dumps(msg.tool_calls, ensure_ascii=False))
        else:
            input_chars += chars
    return _estimate_tokens(input_chars), _estimate_tokens(output_chars)


def compute_turn_usage(
    messages: list[BaseMessage],
    model: str,
    provider: str,
    user_message: str,
) -> dict[str, Any]:
    input_tokens = 0
    output_tokens = 0
    llm_calls = 0

    for msg in messages:
        if isinstance(msg, AIMessage):
            inp, out = _extract_from_ai_message(msg)
            if inp or out:
                input_tokens += inp
                output_tokens += out
                llm_calls += 1

    source: UsageSource = "provider" if llm_calls > 0 and (input_tokens or output_tokens) else "estimated"

    if source == "estimated":
        turn_messages = [
            SystemMessage(content=""),
            HumanMessage(content=user_message),
            *messages,
        ]
        input_tokens, output_tokens = _estimate_messages_tokens(turn_messages)

    total_tokens = input_tokens + output_tokens
    cost = estimate_cost_usd(model, input_tokens, output_tokens)

    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "model": model,
        "provider": provider,
        "source": source,
        "llm_calls": llm_calls,
        "estimated_cost_usd": round(cost, 6),
    }
