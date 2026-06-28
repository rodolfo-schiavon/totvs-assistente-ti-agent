import os
import secrets
from typing import Optional

from jose import jwt, JWTError


def verify_jwt(token: str) -> Optional[dict]:
    secret = os.getenv("AUTH_SECRET", "")
    if not secret:
        return None
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError:
        return None


def verify_agent_secret(header: str | None) -> bool:
    secret = os.getenv("AGENT_SERVICE_SECRET", "").strip()
    if not secret:
        return False
    return secrets.compare_digest(header or "", secret)


def resolve_user_id(payload: Optional[dict]) -> str:
    if payload and payload.get("sub"):
        return str(payload["sub"])
    return "service"
