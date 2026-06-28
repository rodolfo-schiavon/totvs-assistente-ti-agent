"""Emissão assíncrona de eventos de governança para o backend."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import httpx

from services.helpdesk_api import _backend_base

logger = logging.getLogger(__name__)

AGENT_SECRET = os.getenv("AGENT_SERVICE_SECRET", "")
INGEST_TIMEOUT = float(os.getenv("GOVERNANCE_INGEST_TIMEOUT", "3"))


async def _post_ingest(events: list[dict[str, Any]]) -> None:
    if not AGENT_SECRET:
        return
    url = f"{_backend_base()}/api/v1/internal/governance/ingest"
    headers = {"X-Agent-Secret": AGENT_SECRET, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=INGEST_TIMEOUT) as client:
            await client.post(url, headers=headers, json={"events": events})
    except Exception as e:
        logger.warning("governance ingest failed: %s", e)


def emit_governance_events(events: list[dict[str, Any]]) -> None:
    if not events:
        return
    asyncio.create_task(_post_ingest(events))


def emit_turn_event(payload: dict[str, Any]) -> None:
    emit_governance_events([{"type": "turn", **payload}])


def emit_security_event(payload: dict[str, Any]) -> None:
    emit_governance_events([{"type": "security", **payload}])
