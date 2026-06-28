"""Extrai dados tabulares do markdown do agente para fallback visual."""

from __future__ import annotations

import re


def parse_markdown_table(markdown: str) -> list[dict[str, str | int | float]] | None:
    lines = [ln.strip() for ln in markdown.splitlines() if ln.strip().startswith("|")]
    if len(lines) < 2:
        return None

    header_line = lines[0]
    if not re.match(r"^\|?.+\|.+\|?$", header_line):
        return None

    headers = [_clean_cell(c) for c in header_line.strip("|").split("|")]
    if len(headers) < 2:
        return None

    rows: list[dict[str, str | int | float]] = []
    for line in lines[2:]:
        if re.match(r"^\|?\s*[-:]+\s*\|", line):
            continue
        cells = [_clean_cell(c) for c in line.strip("|").split("|")]
        if len(cells) != len(headers):
            continue
        row: dict[str, str | int | float] = {}
        for h, c in zip(headers, cells):
            row[h] = _parse_num(c)
        rows.append(row)

    return rows or None


def table_to_volume_compare(rows: list[dict[str, str | int | float]]) -> list[dict]:
    if not rows:
        return []

    keys = list(rows[0].keys())
    label_key = keys[0]
    opened_key = _find_key(keys, ("aberto", "abertura", "opened"))
    closed_key = _find_key(keys, ("fechado", "encerrado", "closed"))

    if not opened_key and not closed_key:
        return []

    out = []
    for row in rows:
        label = str(row.get(label_key, ""))
        if not label:
            continue
        item = {"period": label, "label": label, "opened": 0, "closed": 0}
        if opened_key:
            item["opened"] = int(row.get(opened_key, 0) or 0)
        if closed_key:
            item["closed"] = int(row.get(closed_key, 0) or 0)
        out.append(item)
    return out


def table_to_simple_series(rows: list[dict[str, str | int | float]], legend: str = "Quantidade") -> list[dict]:
    if not rows:
        return []
    keys = list(rows[0].keys())
    label_key = keys[0]
    value_key = keys[-1] if len(keys) > 1 else keys[0]
    for k in keys[1:]:
        if _looks_numeric_column(rows, k):
            value_key = k
            break
    return [{"name": str(r.get(label_key, "")), "value": int(r.get(value_key, 0) or 0)} for r in rows if r.get(label_key)]


def _find_key(keys: list[str], hints: tuple[str, ...]) -> str | None:
    for k in keys:
        kl = k.lower()
        if any(h in kl for h in hints):
            return k
    return None


def _looks_numeric_column(rows: list[dict], key: str) -> bool:
    for r in rows[:5]:
        v = r.get(key)
        if isinstance(v, (int, float)):
            return True
        if isinstance(v, str) and re.search(r"\d", v):
            return True
    return False


def _clean_cell(cell: str) -> str:
    return re.sub(r"\*\*", "", cell.strip())


def _parse_num(raw: str) -> str | int | float:
    s = _clean_cell(raw)
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    if re.fullmatch(r"-?\d+[.,]\d+", s):
        return float(s.replace(",", "."))
    return s
