"""Sync idempotente: documentos admin → LangGraph Store (VFS /legal-kb/)."""

from __future__ import annotations

import logging
import os
import re
from datetime import UTC, datetime

from app.vfs_backend import KB_VFS_PATH, PROJECT_NAMESPACE
from services.helpdesk_api import HelpdeskApi

logger = logging.getLogger(__name__)

MAX_DOC_CHARS = int(os.getenv("KB_VFS_MAX_CHARS", "1000000"))


def slugify(title: str, doc_id: str) -> str:
    # Preserva extensão original no slug quando presente (ex: planilha.xlsx)
    lower = title.lower().strip()
    ext = ""
    if "." in lower:
        base_name, ext_part = lower.rsplit(".", 1)
        if ext_part and len(ext_part) <= 6 and ext_part.isalnum():
            ext = f".{ext_part}"
            lower = base_name
    base = re.sub(r"[^\w\s-]", "", lower).strip()
    base = re.sub(r"[\s_]+", "-", base)[:80] or "documento"
    suffix = doc_id[:8]
    return f"{base}-{suffix}{ext if ext else '.md'}"


def build_markdown(doc: dict) -> str:
    title = doc.get("title") or "documento"
    preview = (doc.get("extractedPreview") or "")[:300]
    body = doc.get("extractedText") or doc.get("extractedPreview") or ""
    if len(body) > MAX_DOC_CHARS:
        body = body[:MAX_DOC_CHARS] + "\n\n[... conteúdo truncado ...]"
    updated = doc.get("updatedAt") or datetime.now(UTC).isoformat()
    return (
        f"---\n"
        f"título: {title}\n"
        f"id: {doc.get('id')}\n"
        f"mimeType: {doc.get('mimeType')}\n"
        f"sumário: {preview}\n"
        f"updatedAt: {updated}\n"
        f"---\n\n"
        f"{body.strip()}\n"
    )


def file_data(content: str, modified_at: str | None = None) -> dict:
    now = modified_at or datetime.now(UTC).isoformat()
    return {
        "content": content.split("\n"),
        "created_at": now,
        "modified_at": now,
    }


def _payload_has_content(payload: dict) -> bool:
    lines = payload.get("content") or []
    return bool("".join(str(line) for line in lines).strip())


async def sync_document_to_store(store, doc: dict) -> str:
    """Retorna action: seeded | updated | skipped."""
    namespace = (PROJECT_NAMESPACE,)
    key = _doc_key(doc)
    modified = doc.get("updatedAt") or ""
    content = build_markdown(doc)
    payload = file_data(content, modified)

    existing = None
    try:
        existing = await store.aget(namespace, key)
        existing_body = ""
        if existing:
            existing_body = "\n".join(str(x) for x in (existing.value.get("content") or []))
        truncated_existing = "[... conteúdo truncado ...]" in existing_body
        truncated_new = "[... conteúdo truncado ...]" in content
        if (
            existing
            and existing.value.get("modified_at") == payload["modified_at"]
            and _payload_has_content(existing.value)
            and not truncated_existing
            and len(existing_body) >= len(content) - 128
        ):
            return "skipped"
        if existing and truncated_existing and not truncated_new:
            logger.info("re-sync doc=%s: substituindo conteúdo truncado", doc.get("id"))
    except Exception:
        pass

    await store.aput(namespace, key, payload)
    return "updated" if existing else "seeded"


async def delete_document_from_store(store, title: str, doc_id: str) -> None:
    namespace = (PROJECT_NAMESPACE,)
    key = f"/{slugify(title, doc_id)}"
    try:
        await store.adelete(namespace, key)
    except Exception as e:
        logger.warning("vfs delete failed key=%s: %s", key, e)


def _doc_key(doc: dict) -> str:
    return f"/{slugify(doc.get('title', 'doc'), doc.get('id', ''))}"


async def list_vfs_keys(store) -> list[str]:
    """Lista keys no namespace legal-kb."""
    namespace = (PROJECT_NAMESPACE,)
    keys: list[str] = []
    try:
        items = await store.asearch(namespace, limit=500)
        keys = [str(item.key) for item in items if item.key]
    except Exception as e:
        logger.warning("list_vfs_keys failed: %s", e)
    return sorted(keys)


async def list_vfs_files(store) -> list[dict]:
    """Metadados dos arquivos no VFS (para preflight do agente)."""
    namespace = (PROJECT_NAMESPACE,)
    files: list[dict] = []
    try:
        items = await store.asearch(namespace, limit=500)
        for item in items:
            val = item.value or {}
            content = val.get("content") or []
            size = sum(len(str(line)) for line in content)
            files.append({
                "key": str(item.key),
                "path": f"{KB_VFS_PATH.rstrip('/')}{item.key}",
                "size": size,
                "modified_at": val.get("modified_at", ""),
            })
    except Exception as e:
        logger.warning("list_vfs_files failed: %s", e)
    return files


async def sync_all_documents(store) -> dict[str, int | str | list]:
    api = HelpdeskApi()
    try:
        data = await api.knowledge_vfs_export()
    except Exception as e:
        logger.exception("vfs export failed: %s", e)
        return {"seeded": 0, "updated": 0, "skipped": 0, "failed": 0, "total": 0, "error": str(e)[:500]}

    docs = data.get("documents") or []
    counts: dict[str, int | str | list] = {"seeded": 0, "updated": 0, "skipped": 0, "failed": 0, "removed": 0}
    expected_keys = {_doc_key(d) for d in docs}

    for doc in docs:
        try:
            action = await sync_document_to_store(store, doc)
            counts[action] = int(counts.get(action, 0)) + 1
        except Exception as e:
            logger.exception("sync failed doc=%s: %s", doc.get("id"), e)
            counts["failed"] = int(counts["failed"]) + 1
            try:
                await api.knowledge_vfs_sync_status(doc["id"], "error", str(e)[:500])
            except Exception:
                pass
        else:
            try:
                await api.knowledge_vfs_sync_status(doc["id"], "synced", None)
            except Exception:
                pass

    # Remove keys órfãs (documentos deletados no admin)
    namespace = (PROJECT_NAMESPACE,)
    try:
        existing = await store.asearch(namespace, limit=500)
        for item in existing:
            key = str(item.key)
            if key not in expected_keys:
                try:
                    await store.adelete(namespace, key)
                    counts["removed"] = int(counts["removed"]) + 1
                except Exception as e:
                    logger.warning("orphan delete failed key=%s: %s", key, e)
    except Exception as e:
        logger.warning("orphan scan failed: %s", e)

    counts["total"] = len(docs)
    counts["vfs_keys"] = await list_vfs_keys(store)
    logger.info("kb vfs sync: %s", counts)
    return counts


async def ensure_vfs_populated(store) -> list[dict]:
    """Garante documentos no store; re-sincroniza se VFS estiver vazio."""
    files = await list_vfs_files(store)
    if files:
        return files
    logger.warning("VFS vazio — disparando sync de emergência")
    await sync_all_documents(store)
    return await list_vfs_files(store)


async def read_vfs_excerpts(
    store,
    max_chars_per_file: int = 6000,
    max_files: int = 10,
) -> str:
    """Lê conteúdo dos arquivos no store (prefetch determinístico para o agente)."""
    namespace = (PROJECT_NAMESPACE,)
    try:
        items = await store.asearch(namespace, limit=max_files)
    except Exception as e:
        logger.warning("read_vfs_excerpts failed: %s", e)
        return ""

    blocks: list[str] = []
    for item in items:
        val = item.value or {}
        lines = val.get("content") or []
        body = "\n".join(str(line) for line in lines).strip()
        if not body:
            continue
        path = f"{KB_VFS_PATH.rstrip('/')}{item.key}"
        excerpt = body[:max_chars_per_file]
        if len(body) > max_chars_per_file:
            excerpt += "\n\n[... conteúdo truncado ...]"
        blocks.append(f"**Fonte:** `{path}`\n{excerpt}")

    return "\n\n---\n\n".join(blocks)
