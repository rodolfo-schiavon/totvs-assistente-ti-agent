"""Proteções contra prompt injection — Legal AI Workspace."""

from __future__ import annotations

import re
from typing import NamedTuple


class InjectionMatch(NamedTuple):
    pattern: str
    severity: str


_INJECTION_RULES: tuple[tuple[str, str], ...] = (
    (r"ignore\s+(all\s+)?(previous|prior)\s+instructions", "alta"),
    (r"reveal\s+(the\s+)?system\s+prompt", "critica"),
    (r"ignore\s+lgpd", "alta"),
    (r"expose\s+(secrets|keys|credentials)", "critica"),
    (r"you\s+are\s+now\s+", "alta"),
    (r"jailbreak", "critica"),
    (r"modo\s+desenvolvedor", "alta"),
    (r"ignore\s+suas\s+regras", "alta"),
    (r"bypass\s+(security|filter|guard)", "critica"),
    (r"dump\s+(env|environment|config)", "critica"),
)


def detect_prompt_injection(text: str) -> InjectionMatch | None:
    low = (text or "").lower()
    for pattern, severity in _INJECTION_RULES:
        if re.search(pattern, low):
            return InjectionMatch(pattern=pattern, severity=severity)
    return None


def guard_input(text: str) -> tuple[bool, str, str | None, InjectionMatch | None]:
    match = detect_prompt_injection(text)
    if match:
        return False, text, "Solicitação bloqueada por política de segurança.", match
    if len(text) > 32000:
        return True, text[:32000], None, None
    return True, text, None, None
