from langchain_core.messages import AIMessage, HumanMessage

from services.token_usage import compute_turn_usage


def test_compute_turn_usage_from_provider_metadata():
    messages = [
        AIMessage(
            content="Resposta",
            usage_metadata={"input_tokens": 100, "output_tokens": 50, "total_tokens": 150},
        )
    ]
    usage = compute_turn_usage(messages, "gpt-4o-mini", "openai", "Pergunta")
    assert usage["source"] == "provider"
    assert usage["input_tokens"] == 100
    assert usage["output_tokens"] == 50
    assert usage["total_tokens"] == 150
    assert usage["estimated_cost_usd"] > 0


def test_compute_turn_usage_estimated_fallback():
    messages = [AIMessage(content="Resposta curta")]
    usage = compute_turn_usage(messages, "gpt-4o-mini", "openai", "Quantos tickets abertos?")
    assert usage["source"] == "estimated"
    assert usage["total_tokens"] > 0
