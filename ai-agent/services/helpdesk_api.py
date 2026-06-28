import os
from typing import Any, Optional

import httpx

def _backend_base() -> str:
    """Prefer URL interna Railway (mesmo ambiente) sobre URL pública de outro ambiente."""
    for key in ("BACKEND_INTERNAL_URL", "LEGAL_API_URL", "HELPDESK_API_URL"):
        val = os.getenv(key, "").strip().rstrip("/")
        if val:
            return val
    return "http://localhost:8000"


BASE = _backend_base()
SECRET = os.getenv("API_SECRET", "")
AI_AGENT_URL = os.getenv("AI_AGENT_URL", "http://localhost:8100").rstrip("/")
AGENT_SECRET = os.getenv("AGENT_SERVICE_SECRET", "")


class HelpdeskApi:
    def __init__(self, bearer_token: str | None = None):
        self.bearer_token = bearer_token
        self.headers = {"X-Api-Secret": SECRET}
        if bearer_token:
            self.headers["Authorization"] = f"Bearer {bearer_token}"

    async def audit(self, payload: dict) -> None:
        tools = payload.get("toolsCalled")
        audit_payload = {
            "userId": payload.get("userId"),
            "conversationId": payload.get("conversationId"),
            "question": payload.get("question"),
            "modelUsed": payload.get("modelUsed"),
            "latencyMs": payload.get("latencyMs"),
            "error": payload.get("error"),
            "toolsCalled": tools if isinstance(tools, list) else None,
            "route": payload.get("route"),
            "recordsReturned": payload.get("recordsReturned"),
            "sources": payload.get("sources"),
            "analysisType": payload.get("analysisType"),
        }
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(f"{BASE}/api/v1/agent/audit", headers=self.headers, json=audit_payload)

    async def conversation_owned(self, conversation_id: str) -> bool:
        if not self.bearer_token:
            return False
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{BASE}/api/v1/agent/conversations/{conversation_id}",
                headers=self.headers,
            )
            return r.status_code == 200

    async def attachment_context(self, attachment_ids: list[str]) -> dict[str, Any]:
        if not attachment_ids:
            return {"attachments": []}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{BASE}/api/v1/agent/attachments",
                headers=self.headers,
                params={"ids": ",".join(attachment_ids)},
            )
            r.raise_for_status()
            return r.json()

    async def knowledge_vfs_export(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.get(f"{BASE}/api/v1/knowledge/documents/vfs-export", headers=self.headers)
            r.raise_for_status()
            return r.json()

    async def knowledge_vfs_sync_status(
        self, document_id: str, status: str, error: str | None = None
    ) -> None:
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                f"{BASE}/api/v1/knowledge/documents/{document_id}/vfs-sync-status",
                headers=self.headers,
                json={"status": status, "error": error},
            )

    async def trigger_kb_sync(self) -> dict[str, Any]:
        headers = {"X-Agent-Secret": AGENT_SECRET} if AGENT_SECRET else self.headers
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{AI_AGENT_URL}/v1/kb/sync", headers=headers)
            r.raise_for_status()
            return r.json()
