"""Normaliza respostas documentais: limpa citações inline e extrai fontes."""

from __future__ import annotations

import re

from langchain_core.messages import AIMessage, BaseMessage, ToolMessage

VFS_PATH_RE = re.compile(r"/legal-kb/[^\s`,\)>\]]+")

# Citações inline que poluem a resposta ao usuário
_INLINE_NOISE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\s*\(\s*conforme\s+`?/legal-kb/[^`)]+`?\s*,?\s*linha\s+\d+[^)]*\)",
        re.I,
    ),
    re.compile(r"\s*\(\s*conforme\s+`?/legal-kb/[^`)]+`?\s*\)", re.I),
    re.compile(r"\s*\(\s*fonte:\s*`?/legal-kb/[^`)]+`?[^)]*\)", re.I),
    re.compile(r"`/legal-kb/[^`]+`\s*,?\s*linha\s+\d+", re.I),
    re.compile(r"conforme\s+`/legal-kb/[^`]+`(?:\s*,?\s*linha\s+\d+)?", re.I),
    re.compile(r"em\s+`/legal-kb/[^`]+`(?:\s*,?\s*linha\s+\d+)?", re.I),
    re.compile(r"\s*,?\s*linha\s+\d+(?:\s*,?\s*linha\s+\d+)*", re.I),
    re.compile(r"Há também uma menção[^.]+\.", re.I),
)

_DOC_CITATION_RE = re.compile(r"\[Doc:\s*([^\]]+)\]", re.I)


def path_to_display_name(path: str) -> str:
    """Converte path VFS em nome legível para o usuário."""
    name = path.rstrip("/").split("/")[-1]
    name = re.sub(r"-[a-z0-9]{6,10}\.(txt|md|xlsx|pdf|docx?)$", "", name, flags=re.I)
    name = re.sub(r"\.(txt|md|xlsx|pdf|docx?)$", "", name, flags=re.I)
    name = name.replace("-", " ").replace("_", " ").strip()
    if not name:
        return path
    return " ".join(w.capitalize() if w.islower() else w for w in name.split())


def extract_vfs_paths_from_text(text: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for match in VFS_PATH_RE.finditer(text or ""):
        p = match.group(0).rstrip(".,;:")
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _text_from_message(msg: BaseMessage) -> str:
    content = msg.content
    if isinstance(content, str):
        return content
    return str(content)


def extract_document_paths(
    messages: list[BaseMessage] | None,
    markdown: str,
    vfs_files: list[dict] | None,
) -> list[str]:
    """Coleta paths VFS usados na conversa (tools + resposta)."""
    paths: list[str] = []
    seen: set[str] = set()

    def add(path: str) -> None:
        p = path.rstrip(".,;:")
        if p and p not in seen:
            seen.add(p)
            paths.append(p)

    for path in extract_vfs_paths_from_text(markdown):
        add(path)

    for msg in messages or []:
        if isinstance(msg, (AIMessage, ToolMessage)):
            for path in extract_vfs_paths_from_text(_text_from_message(msg)):
                add(path)

    for f in vfs_files or []:
        p = f.get("path")
        if isinstance(p, str):
            add(p)

    return paths


def document_display_names(paths: list[str]) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for path in paths:
        name = path_to_display_name(path)
        key = name.lower()
        if key not in seen:
            seen.add(key)
            names.append(name)
    return names


_TABLE_PLACEHOLDER = "@@MD_TABLE_{}@@"
_TABLE_BLOCK_RE = re.compile(
    r"(?:^|\n)(\|.+\|\s*\n\|[-:\s|]+\|\s*\n(?:\|.+\|\s*\n?)+)",
    re.MULTILINE,
)


def _stash_markdown_tables(text: str) -> tuple[str, list[str]]:
    """Preserva tabelas GFM antes de limpezas que colapsam quebras de linha."""
    tables: list[str] = []

    def _replace(match: re.Match[str]) -> str:
        tables.append(match.group(1))
        return f"\n{_TABLE_PLACEHOLDER.format(len(tables) - 1)}\n"

    return _TABLE_BLOCK_RE.sub(_replace, text), tables


def _restore_markdown_tables(text: str, tables: list[str]) -> str:
    for i, block in enumerate(tables):
        text = text.replace(_TABLE_PLACEHOLDER.format(i), block)
    return text


def clean_documental_markdown(markdown: str) -> str:
    """Remove paths/linhas inline; mantém texto legível e tabelas markdown."""
    text = (markdown or "").strip()
    if not text:
        return text

    text, tables = _stash_markdown_tables(text)

    for pattern in _INLINE_NOISE_PATTERNS:
        text = pattern.sub("", text)

    # Paths soltos em backticks no meio da frase
    text = re.sub(r"`/legal-kb/[^`]+`", "", text)

    # Seções vazadas do researcher
    if _looks_like_researcher_report(text):
        text = _strip_researcher_sections(text)

    # Colapsa espaços horizontais apenas — nunca newlines (preserva listas/parágrafos)
    text = re.sub(r"[^\S\n]{2,}", " ", text)
    text = re.sub(r" +\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"\*\*\s*\*\*", "", text)

    text = _restore_markdown_tables(text, tables)
    return text.strip()


def _looks_like_researcher_report(text: str) -> bool:
    low = text.lower()
    markers = ("achados principais", "evidências com paths", "pontos de incerteza")
    return sum(1 for m in markers if m in low) >= 2


def _strip_researcher_sections(text: str) -> str:
    """Extrai bullets úteis do relatório researcher, descarta metadados."""
    lines = text.splitlines()
    useful: list[str] = []
    in_achados = False
    for line in lines:
        low = line.lower().strip()
        if "achados principais" in low:
            in_achados = True
            continue
        if any(h in low for h in ("evidências com paths", "evidencia com paths", "pontos de incerteza")):
            in_achados = False
            continue
        if in_achados and line.strip().startswith(("-", "*", "•")):
            cleaned = re.sub(r"`/legal-kb/[^`]+`", "", line)
            cleaned = re.sub(r",?\s*linha\s+\d+", "", cleaned, flags=re.I)
            useful.append(cleaned.strip())
    if useful:
        return "\n".join(useful)
    return text


def append_doc_citation_tags(markdown: str, doc_names: list[str]) -> str:
    """Adiciona [Doc: ...] no rodapé — padrão consumido pelo frontend."""
    existing = {m.group(1).strip().lower() for m in _DOC_CITATION_RE.finditer(markdown)}
    tags: list[str] = []
    for name in doc_names:
        if name.lower() not in existing:
            tags.append(f"[Doc: {name}]")
    if not tags:
        return markdown
    block = " ".join(tags)
    return f"{markdown.rstrip()}\n\n{block}"


def prepare_documental_response(
    markdown: str,
    messages: list[BaseMessage] | None,
    vfs_files: list[dict] | None,
    route: str | None,
) -> tuple[str, list[str]]:
    """Limpa markdown e retorna nomes de documentos para metadados/UI."""
    if route not in ("documental", "hybrid"):
        return markdown, []

    paths = extract_document_paths(messages, markdown, vfs_files)
    doc_names = document_display_names(paths)

    cleaned = clean_documental_markdown(markdown)
    if doc_names:
        cleaned = append_doc_citation_tags(cleaned, doc_names)

    return cleaned, doc_names
