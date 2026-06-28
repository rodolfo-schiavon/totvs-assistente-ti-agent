"""Configura LangSmith / LangChain tracing antes de importar o grafo."""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

_TRUTHY = frozenset({"true", "1", "yes", "on"})


def _truthy(val: str | None) -> bool:
    return (val or "").strip().lower() in _TRUTHY


def _clean(val: str | None) -> str:
    if not val:
        return ""
    v = val.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
        return v[1:-1].strip()
    return v


def _tracing_requested() -> bool:
    return any(
        _truthy(os.getenv(name))
        for name in (
            "LANGSMITH_TRACING",
            "LANGSMITH_TRACING_V2",
            "LANGCHAIN_TRACING_V2",
            "LANGCHAIN_TRACING",
        )
    )


def _resolve_api_key() -> str:
    return _clean(os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY"))


def _resolve_project() -> str:
    return _clean(
        os.getenv("LANGSMITH_PROJECT")
        or os.getenv("LANGCHAIN_PROJECT")
        or "helpdesk-agent"
    )


def _resolve_endpoint() -> str:
    return _clean(os.getenv("LANGSMITH_ENDPOINT") or os.getenv("LANGCHAIN_ENDPOINT"))


def _resolve_workspace_id(api_key: str, endpoint: str) -> str | None:
    existing = _clean(
        os.getenv("LANGSMITH_WORKSPACE_ID") or os.getenv("LANGCHAIN_WORKSPACE_ID")
    )
    if existing:
        return existing

    try:
        res = httpx.get(
            f"{endpoint.rstrip('/')}/workspaces",
            headers={"x-api-key": api_key},
            timeout=15,
        )
        res.raise_for_status()
        workspaces = res.json()
        if isinstance(workspaces, list) and workspaces:
            ws_id = str(workspaces[0].get("id", "")).strip()
            if ws_id:
                logger.info(
                    "LangSmith workspace resolvido automaticamente: %s (%s)",
                    ws_id,
                    workspaces[0].get("display_name", "workspace"),
                )
                return ws_id
    except Exception as exc:
        logger.warning("LangSmith: falha ao resolver workspace automaticamente: %s", exc)
    return None


def _sync_env(project: str, api_key: str, endpoint: str, workspace_id: str | None) -> None:
    """LangChain e LangSmith leem nomes diferentes — espelhamos todos."""
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = api_key
    os.environ["LANGSMITH_API_KEY"] = api_key
    os.environ["LANGCHAIN_PROJECT"] = project
    os.environ["LANGSMITH_PROJECT"] = project
    if endpoint:
        os.environ["LANGCHAIN_ENDPOINT"] = endpoint
        os.environ["LANGSMITH_ENDPOINT"] = endpoint
    if workspace_id:
        os.environ["LANGSMITH_WORKSPACE_ID"] = workspace_id
        os.environ["LANGCHAIN_WORKSPACE_ID"] = workspace_id


def get_tracing_status() -> dict[str, object]:
    api_key = _resolve_api_key()
    requested = _tracing_requested()
    enabled = requested and bool(api_key)
    workspace_id = _clean(
        os.getenv("LANGSMITH_WORKSPACE_ID") or os.getenv("LANGCHAIN_WORKSPACE_ID")
    ) or None
    return {
        "enabled": enabled,
        "requested": requested,
        "has_api_key": bool(api_key),
        "has_workspace_id": bool(workspace_id),
        "project": _resolve_project() if enabled else None,
        "workspace_id": workspace_id,
        "endpoint": _resolve_endpoint() or "https://api.smith.langchain.com",
        "env_flags": {
            "LANGSMITH_TRACING": os.getenv("LANGSMITH_TRACING"),
            "LANGCHAIN_TRACING_V2": os.getenv("LANGCHAIN_TRACING_V2"),
        },
    }


def _verify_connection(project: str) -> str | None:
    try:
        from langsmith import Client

        client = Client()
        client.flush()
        list(client.list_runs(project_name=project, limit=1))
        return None
    except Exception as exc:
        return str(exc)[:300]


def configure_tracing() -> bool:
    if not _tracing_requested():
        logger.info("LangSmith tracing desativado (defina LANGSMITH_TRACING=true ou LANGCHAIN_TRACING_V2=true)")
        return False

    api_key = _resolve_api_key()
    if not api_key:
        logger.warning(
            "LangSmith tracing solicitado, mas LANGSMITH_API_KEY / LANGCHAIN_API_KEY não está definida"
        )
        return False

    project = _resolve_project()
    endpoint = _resolve_endpoint() or "https://api.smith.langchain.com"
    workspace_id = _resolve_workspace_id(api_key, endpoint)
    if not workspace_id:
        logger.warning(
            "LangSmith: LANGSMITH_WORKSPACE_ID ausente e auto-resolve falhou. "
            "Chaves org-scoped retornam 403 sem workspace."
        )

    _sync_env(project, api_key, endpoint, workspace_id)

    logger.info(
        "LangSmith tracing ativo → project=%r workspace=%s endpoint=%s",
        project,
        workspace_id or "(none)",
        endpoint,
    )

    if _truthy(os.getenv("LANGSMITH_VERIFY", "true")):
        err = _verify_connection(project)
        if err:
            logger.warning("LangSmith: verificação falhou: %s", err)
        else:
            logger.info("LangSmith: conexão verificada (project=%r)", project)

    return True
