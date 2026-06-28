"""CompositeBackend VFS: /platform-kb/ persistente + /workspace/ efêmero."""

from __future__ import annotations

import os

from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

PROJECT_NAMESPACE = "platform-kb"
KB_VFS_PATH = os.getenv("KB_VFS_PATH", "/platform-kb/")


def store_namespace(_ctx) -> tuple[str, ...]:
    return (PROJECT_NAMESPACE,)


def build_vfs_backend(runtime):
    kb_path = KB_VFS_PATH if KB_VFS_PATH.endswith("/") else f"{KB_VFS_PATH}/"
    return CompositeBackend(
        default=StateBackend(runtime),
        routes={kb_path: StoreBackend(runtime, namespace=store_namespace)},
    )
