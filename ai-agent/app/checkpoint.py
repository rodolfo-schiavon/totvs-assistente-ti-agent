import os

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres import AsyncPostgresStore

_saver_cm = None
_store_cm = None
_checkpointer: AsyncPostgresSaver | None = None
_store: AsyncPostgresStore | None = None


async def open_checkpointer() -> None:
    global _saver_cm, _checkpointer
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL obrigatório para checkpointer")
    if _saver_cm is not None:
        await close_checkpointer()
    _saver_cm = AsyncPostgresSaver.from_conn_string(db_url)
    _checkpointer = await _saver_cm.__aenter__()
    await _checkpointer.setup()


async def open_store() -> None:
    global _store_cm, _store
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL obrigatório para LangGraph store")
    if _store_cm is not None:
        await close_store()
    _store_cm = AsyncPostgresStore.from_conn_string(db_url)
    _store = await _store_cm.__aenter__()
    await _store.setup()


async def close_checkpointer() -> None:
    global _saver_cm, _checkpointer
    if _saver_cm is not None:
        await _saver_cm.__aexit__(None, None, None)
    _saver_cm = None
    _checkpointer = None


async def close_store() -> None:
    global _store_cm, _store
    if _store_cm is not None:
        await _store_cm.__aexit__(None, None, None)
    _store_cm = None
    _store = None


async def ensure_checkpointer_ready() -> AsyncPostgresSaver:
    global _checkpointer
    if _checkpointer is None:
        await open_checkpointer()
        return _checkpointer
    await _checkpointer.setup()
    return _checkpointer


async def ensure_store_ready() -> AsyncPostgresStore:
    global _store
    if _store is None:
        await open_store()
        return _store
    await _store.setup()
    return _store


def get_checkpointer() -> AsyncPostgresSaver:
    if _checkpointer is None:
        raise RuntimeError("Checkpointer não inicializado")
    return _checkpointer


def get_store() -> AsyncPostgresStore:
    if _store is None:
        raise RuntimeError("Store não inicializado")
    return _store
