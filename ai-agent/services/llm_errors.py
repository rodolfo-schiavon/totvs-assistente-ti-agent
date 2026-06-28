"""Mensagens amigáveis para erros de LLM expostos ao usuário."""

import re


def friendly_llm_error(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return "Erro ao processar a solicitação no agente."

    low = text.lower()
    if "not_found_error" in low or ("404" in low and "model:" in low):
        model_match = re.search(r"model:\s*([^\s\"'}]+)", text)
        model_id = model_match.group(1) if model_match else None
        if model_id:
            return (
                f"O modelo configurado ({model_id}) não está mais disponível na Anthropic. "
                "Peça ao administrador para atualizar em **Admin → LLM** e escolher um modelo ativo "
                "(ex.: Claude Sonnet 4.5)."
            )
        return (
            "O modelo de IA configurado não está mais disponível. "
            "Peça ao administrador para atualizar em **Admin → LLM**."
        )

    if "401" in low and "api" in low:
        return "Chave da API Anthropic inválida ou expirada. Verifique em **Admin → LLM**."

    return text[:500]
