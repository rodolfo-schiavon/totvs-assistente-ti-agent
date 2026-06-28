import re

# Perguntas claramente sobre métricas/chamados do help desk importado
_ANALYTICS_HINTS = (
    "chamado",
    "ticket",
    "sla",
    "técnico",
    "tecnico",
    "aberto",
    "abertos",
    "fechado",
    "fechados",
    "kpi",
    "volume",
    "mttr",
    "mtta",
    "itil",
    "backlog",
    "resolução",
    "resolucao",
    "reaberto",
    "prioridade",
    "categoria",
    "spiceworks",
    "help desk",
    "helpdesk",
    "fila",
    "atendimento",
    "solicitante",
    "cliente",
    "organização",
    "organizacao",
)

_KB_META_HINTS = (
    "base de conhecimento",
    "documento",
    "documentos",
    "runbook",
    "política",
    "politica",
    "pdf",
    "anexo",
    "upload",
    "o que tem na base",
    "quais documentos",
    "listar documentos",
)


def looks_like_analytics(question: str) -> bool:
    t = question.lower()
    return any(h in t for h in _ANALYTICS_HINTS)


def looks_like_kb_meta(question: str) -> bool:
    t = question.lower()
    return any(h in t for h in _KB_META_HINTS)


def should_prefetch_knowledge(question: str, knowledge_mode: bool) -> bool:
    if knowledge_mode:
        return True
    if looks_like_kb_meta(question):
        return True
    if not looks_like_analytics(question):
        return True
    return False
