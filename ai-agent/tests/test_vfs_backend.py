"""Tests for VFS CompositeBackend configuration."""

from app.vfs_backend import KB_VFS_PATH, PROJECT_NAMESPACE, store_namespace


def test_project_namespace():
    assert PROJECT_NAMESPACE == "legal-kb"


def test_store_namespace_returns_tuple():
    assert store_namespace(None) == (PROJECT_NAMESPACE,)


def test_kb_vfs_path_default():
    assert KB_VFS_PATH.startswith("/legal-kb")
