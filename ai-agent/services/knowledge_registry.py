"""Cliente da Knowledge Registry para busca semântica."""

from __future__ import annotations

import os

import httpx

KNOWLEDGE_REGISTRY_URL = os.getenv(
    "KNOWLEDGE_REGISTRY_URL", "http://knowledge-registry.platform.svc:8080"
)
DEFAULT_COLLECTION = os.getenv("KB_COLLECTION", "platform-docs")


def search_platform_docs(query: str, limit: int = 5) -> str:
    try:
        with httpx.Client(timeout=20) as client:
            r = client.get(
                f"{KNOWLEDGE_REGISTRY_URL}/api/v1/collections/{DEFAULT_COLLECTION}/search",
                params={"q": query, "limit": limit},
            )
            r.raise_for_status()
            hits = r.json().get("hits", [])
            if not hits:
                return ""
            lines = [f"- {h.get('path')}: {str(h.get('text', ''))[:300]}" for h in hits]
            return "\n".join(lines)
    except Exception:
        return ""
