"""Carrega prompts versionados do Prompt Registry."""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

PROMPT_REGISTRY_URL = os.getenv(
    "PROMPT_REGISTRY_URL", "http://prompt-registry.platform.svc:8080"
)
AGENT_ID = os.getenv("AGENT_ID", "assistente-ti")
_CACHE: dict[str, tuple[float, str]] = {}
_TTL_SEC = int(os.getenv("PROMPT_CACHE_TTL_SEC", "300"))

_FALLBACK: dict[str, str] = {
    "system": (
        "Você é o Assistente de TI da plataforma TOTVS AI Agent Lab. "
        "Responda sobre saúde do cluster, Argo, Prometheus, Langfuse e MLflow. "
        "Use ferramentas MCP — nunca sugira kubectl ou shell. Somente leitura."
    ),
    "researcher": (
        "Pesquise documentação em /platform-kb/ e devolva relatório interno com evidências."
    ),
    "analyst": (
        "Analise métricas operacionais e devolva relatório interno com achados e incertezas."
    ),
}


def _cache_key(agent: str, prompt_id: str) -> str:
    return f"{agent}:{prompt_id}"


def get_prompt(prompt_id: str, agent: str = AGENT_ID, version: str = "latest") -> str:
    key = _cache_key(agent, prompt_id)
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now - cached[0] < _TTL_SEC:
        return cached[1]
    url = f"{PROMPT_REGISTRY_URL}/api/v1/prompts/{agent}/{prompt_id}"
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(url, params={"version": version})
            r.raise_for_status()
            content = str(r.json().get("content", "")).strip()
            if content:
                _CACHE[key] = (now, content)
                return content
    except Exception:
        pass
    return _FALLBACK.get(prompt_id, _FALLBACK["system"])


def build_main_system_prompt(kb_path: str = "/platform-kb/") -> str:
    base = get_prompt("system")
    return f"{base}\n\nBase documental VFS: `{kb_path}`"


def action_tools_prompt_suffix(route: str | None) -> str:
    if route not in ("operational", "analytical"):
        return ""
    return (
        "\n\n## Ações mutáveis (aprovação humana obrigatória)\n"
        "Você TEM a ferramenta `propose_action` (não é MCP). Use-a para:\n"
        "- rollout_restart (namespace + deployment)\n"
        "- argo_refresh / argo_sync (app_name)\n"
        "- workflow_dispatch (workflow)\n"
        "Nunca diga que propose_action não está disponível — chame a ferramenta e informe que o usuário deve aprovar na UI.\n"
    )


def build_researcher_system_prompt(kb_path: str = "/platform-kb/") -> str:
    return f"{get_prompt('researcher')}\n\nPath: `{kb_path}`"


def build_analyst_system_prompt() -> str:
    return get_prompt("analyst")
