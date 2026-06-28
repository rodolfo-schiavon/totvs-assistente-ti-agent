"""Detecta tool calls VFS + analytics para observabilidade."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, ToolMessage

VFS_TOOLS = {
    "ls", "grep", "glob", "read_file", "write_file", "edit_file", "task",
}


def extract_tool_calls(messages: list[BaseMessage]) -> list[str]:
    names: list[str] = []
    for m in messages:
        if isinstance(m, AIMessage) and m.tool_calls:
            for tc in m.tool_calls:
                name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
                if name:
                    names.append(str(name))
    return names


def estimate_records_from_tools(messages: list[BaseMessage]) -> int:
    total = 0
    for m in messages:
        if not isinstance(m, ToolMessage):
            continue
        try:
            content = m.content
            if isinstance(content, str):
                data = json.loads(content)
            elif isinstance(content, dict):
                data = content
            else:
                continue
            if isinstance(data.get("items"), list):
                total += len(data["items"])
            elif isinstance(data.get("tickets"), list):
                total += len(data["tickets"])
            elif data.get("results"):
                total += len(data["results"])
            elif data.get("item"):
                total += 1
        except (json.JSONDecodeError, TypeError, AttributeError):
            continue
    return total


def tools_to_source_type(tool_names: list[str], route: str | None = None) -> str:
    has_vfs = any(t in VFS_TOOLS for t in tool_names)
    has_sys = any(t not in VFS_TOOLS and t != "describe_data_catalog" for t in tool_names)
    if route == "hybrid" or (has_vfs and has_sys):
        return "hybrid"
    if has_vfs or route == "documental":
        return "knowledge"
    if has_sys:
        return "system"
    route_source = {
        "documental": "knowledge",
        "operational": "system",
        "analytical": "system",
        "report": "system",
        "hybrid": "hybrid",
        "clarify": "hybrid",
    }
    if route:
        return route_source.get(route, "system")
    return "system"
