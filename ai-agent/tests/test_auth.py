import os

import pytest

from app import auth


def test_verify_agent_secret_rejects_empty_config(monkeypatch):
    monkeypatch.delenv("AGENT_SERVICE_SECRET", raising=False)
    assert auth.verify_agent_secret("anything") is False
    assert auth.verify_agent_secret(None) is False


def test_verify_agent_secret_accepts_valid_header(monkeypatch):
    monkeypatch.setenv("AGENT_SERVICE_SECRET", "super-secret")
    assert auth.verify_agent_secret("super-secret") is True
    assert auth.verify_agent_secret("wrong") is False


def test_resolve_user_id_from_jwt():
    assert auth.resolve_user_id({"sub": "user-123"}) == "user-123"
    assert auth.resolve_user_id(None) == "service"


def test_verify_jwt_without_secret(monkeypatch):
    monkeypatch.delenv("AUTH_SECRET", raising=False)
    assert auth.verify_jwt("token") is None
