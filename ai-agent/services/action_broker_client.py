"""Cliente para propor ações mutáveis (aprovação humana obrigatória)."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", os.getenv("LEGAL_API_URL", "http://localhost:8000")).rstrip(
    "/"
)
AGENT_SECRET = os.getenv("AGENT_SERVICE_SECRET", "")

_ACTION_TYPES = frozenset(
    {"rollout_restart", "argo_refresh", "argo_sync", "workflow_dispatch"}
)


def _headers(user_id: str | None = None) -> dict[str, str]:
    h = {"X-Agent-Secret": AGENT_SECRET, "Content-Type": "application/json"}
    if user_id:
        h["X-User-Id"] = user_id
    return h


def _propose(
    action_type: str,
    summary: str,
    params: dict[str, Any],
    risk: str,
    user_id: str,
    conversation_id: str | None = None,
) -> str:
    if action_type not in _ACTION_TYPES:
        return json.dumps({"error": f"ação não permitida: {action_type}"})
    with httpx.Client(timeout=30) as client:
        r = client.post(
            f"{BACKEND_URL}/api/v1/internal/actions/propose",
            headers=_headers(),
            json={
                "userId": user_id,
                "conversationId": conversation_id,
                "actionType": action_type,
                "params": params,
                "summary": summary,
                "risk": risk,
            },
        )
        if r.status_code >= 400:
            return json.dumps({"error": r.text[:300]})
        return json.dumps(r.json(), ensure_ascii=False)


def action_tools_for_route(route: str, user_id: str, conversation_id: str | None = None) -> list[StructuredTool]:
    if route not in ("operational", "analytical"):
        return []

    class ProposeParams(BaseModel):
        action_type: str = Field(
            description="rollout_restart | argo_refresh | argo_sync | workflow_dispatch"
        )
        summary: str = Field(description="Resumo legível da ação para o usuário aprovar")
        risk: str = Field(default="medium", description="low | medium | high")
        namespace: str = Field(default="", description="Namespace K8s (rollout_restart)")
        deployment: str = Field(default="", description="Nome do deployment (rollout_restart)")
        app_name: str = Field(default="", description="Application Argo CD (argo_*)")
        workflow: str = Field(default="", description="Workflow GitHub (workflow_dispatch)")

    def _run(**kwargs: Any) -> str:
        action_type = kwargs.pop("action_type")
        summary = kwargs.pop("summary")
        risk = kwargs.pop("risk", "medium")
        params = {k: v for k, v in kwargs.items() if v}
        return _propose(action_type, summary, params, risk, user_id, conversation_id)

    return [
        StructuredTool.from_function(
            func=_run,
            name="propose_action",
            description=(
                "Propõe ação mutável no cluster/CI. NUNCA executa direto — "
                "o usuário deve aprovar na UI. Use para sync Argo, restart ou disparar eval."
            ),
            args_schema=ProposeParams,
        )
    ]
