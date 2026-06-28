import os
from typing import Any, Optional

import httpx


async def fetch_active_llm() -> dict[str, Any]:
    base = os.getenv("BACKEND_INTERNAL_URL", os.getenv("HELPDESK_API_URL", "http://localhost:8000")).rstrip("/")
    secret = os.getenv("AGENT_SERVICE_SECRET", "")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{base}/api/v1/internal/llm/active",
            headers={"X-Agent-Secret": secret},
        )
        r.raise_for_status()
        return r.json()
