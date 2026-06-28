"""Cliente HTTP para platform-ops-mcp (REST + LangChain tools)."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

PLATFORM_OPS_MCP_URL = os.getenv(
    "PLATFORM_OPS_MCP_URL", "http://platform-ops-mcp.platform.svc:8080"
)

_OPERATIONAL = frozenset(
    {
        "list_argo_applications",
        "get_deployment_health",
        "get_pod_logs_summary",
        "get_gateway_health",
        "recommend_actions",
    }
)
_ANALYTICAL = frozenset(
    {
        "query_prometheus",
        "get_langfuse_project_stats",
        "get_mlflow_experiments",
        "recommend_actions",
    }
)


def _invoke(tool_name: str, payload: dict[str, Any] | None = None) -> str:
    payload = payload or {}
    with httpx.Client(timeout=60) as client:
        r = client.post(f"{PLATFORM_OPS_MCP_URL}/api/v1/tools/{tool_name}", json=payload)
        r.raise_for_status()
        data = r.json()
        result = data.get("result", data)
        if isinstance(result, str):
            return result
        return json.dumps(result, ensure_ascii=False, indent=2)


def mcp_tools_for_route(route: str) -> list[StructuredTool]:
    if route == "documental":
        return []
    names = _OPERATIONAL | _ANALYTICAL if route == "hybrid" else (
        _OPERATIONAL if route == "operational" else _ANALYTICAL
    )
    tools: list[StructuredTool] = []

    class Empty(BaseModel):
        pass

    class Bundle(BaseModel):
        bundle_name: str = Field(default="", description="Filtro opcional por nome do deployment")

    class PromQL(BaseModel):
        promql: str = Field(description="Expressão PromQL read-only")

    class Logs(BaseModel):
        namespace: str
        label_selector: str = ""
        limit: int = 30

    specs: list[tuple[str, str, type[BaseModel]]] = [
        ("list_argo_applications", "Lista applications Argo CD", Empty),
        ("get_deployment_health", "Status deployments/pods da plataforma", Bundle),
        ("query_prometheus", "Query PromQL no Prometheus", PromQL),
        ("get_pod_logs_summary", "Logs recentes via Loki", Logs),
        ("get_langfuse_project_stats", "Health Langfuse", Empty),
        ("get_mlflow_experiments", "Experimentos MLflow", Empty),
        ("get_gateway_health", "Health LLM Gateway", Empty),
        ("recommend_actions", "Checklist operacional agregado", Empty),
    ]
    for name, desc, schema in specs:
        if name not in names:
            continue

        def _make(name=name, schema=schema):
            def _run(**kwargs: Any) -> str:
                return _invoke(name, kwargs)

            return StructuredTool.from_function(
                func=_run,
                name=name,
                description=desc,
                args_schema=schema,
            )

        tools.append(_make())
    return tools
