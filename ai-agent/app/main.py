import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from app.tracing import configure_tracing
from app.otel_tracing import configure_otel, get_otel_status, instrument_fastapi, record_turn_metrics, span_chat_turn

configure_tracing()
configure_otel()

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from app.auth import resolve_user_id, verify_agent_secret, verify_jwt
from app.cors_origins import resolve_cors_origins

from app.checkpoint import (
    close_checkpointer,
    close_store,
    ensure_checkpointer_ready,
    ensure_store_ready,
    open_checkpointer,
    open_store,
)
from app.graph import run_chat, run_chat_stream
from app.schemas import ChatRequest, ChatResponse, MixedResponse, TokenUsageTurn
from services.guards import guard_input
from services.governance_emit import emit_security_event, emit_turn_event
from services.helpdesk_api import HelpdeskApi, _backend_base
from services.kb_vfs_sync import list_vfs_files, sync_all_documents
from services.llm_errors import friendly_llm_error
import json
import logging

logger = logging.getLogger(__name__)


def _empty_usage() -> TokenUsageTurn:
    return TokenUsageTurn(
        input_tokens=0,
        output_tokens=0,
        total_tokens=0,
        model="blocked",
        provider="policy",
        source="estimated",
        llm_calls=0,
        estimated_cost_usd=0.0,
    )


def _blocked_response(message: str) -> MixedResponse:
    return MixedResponse(
        markdown=message,
        sources=[],
        route="blocked",
    )


def _emit_turn_governance(
    *,
    user_id: str,
    conversation_id: str | None,
    body: ChatRequest,
    audit_meta: dict,
    turn_usage: TokenUsageTurn | None,
    latency_ms: int,
    error: str | None = None,
    markdown: str | None = None,
):
    usage = turn_usage or _empty_usage()
    mixed = audit_meta.get("mixed")
    data_limitations = getattr(mixed, "data_limitations", None) if mixed else None
    emit_turn_event(
        {
            "userId": user_id,
            "conversationId": conversation_id,
            "prompt": body.message,
            "analysisType": body.analysis_type,
            "model": usage.model,
            "provider": usage.provider,
            "route": audit_meta.get("route"),
            "inputTokens": usage.input_tokens,
            "outputTokens": usage.output_tokens,
            "totalTokens": usage.total_tokens,
            "estimatedCostUsd": usage.estimated_cost_usd,
            "latencyMs": latency_ms,
            "status": "error" if error else "success",
            "toolsCalled": audit_meta.get("toolsCalled") or [],
            "sources": audit_meta.get("sources") or [],
            "recordsReturned": audit_meta.get("recordsReturned"),
            "vfsFilesCount": audit_meta.get("vfsFilesCount"),
            "error": error,
            "dataLimitations": data_limitations,
            "markdown": markdown,
        }
    )

_last_kb_sync: dict = {"at": None, "counts": None, "error": None}


async def _run_kb_sync() -> dict:
    global _last_kb_sync
    try:
        store = await ensure_store_ready()
        counts = await sync_all_documents(store)
        err = counts.get("error")
        files = await list_vfs_files(store)
        if int(counts.get("total") or 0) > 0 and not files:
            logger.warning("sync concluiu com docs mas VFS vazio — repetindo sync")
            counts = await sync_all_documents(store)
            files = await list_vfs_files(store)
        _last_kb_sync = {
            "at": time.time(),
            "counts": {k: v for k, v in counts.items() if k != "error"},
            "error": err,
            "backend_url": _backend_base(),
        }
        if err:
            logger.error("kb sync error: %s", err)
        return counts
    except Exception as e:
        _last_kb_sync = {"at": time.time(), "counts": None, "error": str(e)[:500], "backend_url": _backend_base()}
        logger.exception("kb sync failed")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await open_checkpointer()
        await open_store()
    except Exception as e:
        logger.error("langgraph postgres init failed: %s", e)
    try:
        await _run_kb_sync()
    except Exception as e:
        logger.warning("startup kb vfs sync failed: %s", e)
    yield
    await close_store()
    await close_checkpointer()


app = FastAPI(title="Legal AI Agent", version="2.1.0", lifespan=lifespan)
instrument_fastapi(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=resolve_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_rate: dict[str, list[float]] = defaultdict(list)
LIMIT = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))


def check_rate(user_key: str):
    now = time.time()
    window = _rate[user_key]
    _rate[user_key] = [t for t in window if now - t < 60]
    if len(_rate[user_key]) >= LIMIT:
        raise HTTPException(429, "Limite de requisições excedido. Tente novamente em instantes.")
    _rate[user_key].append(now)


@app.get("/health")
async def health():
    from app.tracing import get_tracing_status

    vfs_files: list[dict] = []
    try:
        store = await ensure_store_ready()
        vfs_files = await list_vfs_files(store)
    except Exception:
        pass

    return {
        "status": "ok",
        "version": "2.1.0",
        "rag": "vfs3",
        "kb": {
            "file_count": len(vfs_files),
            "last_sync": _last_kb_sync,
            "backend_url": _backend_base(),
        },
        "tracing": get_tracing_status(),
        "otel": get_otel_status(),
    }


@app.get("/v1/kb/status")
async def kb_status(request: Request):
    if not verify_agent_secret(request.headers.get("x-agent-secret")):
        raise HTTPException(401, "Não autorizado")
    store = await ensure_store_ready()
    files = await list_vfs_files(store)
    return {
        "ok": True,
        "file_count": len(files),
        "files": files[:50],
        "last_sync": _last_kb_sync,
        "backend_url": _backend_base(),
    }


@app.post("/v1/kb/sync")
async def kb_sync(
    request: Request,
    background_tasks: BackgroundTasks,
    wait: bool = Query(False),
):
    if not verify_agent_secret(request.headers.get("x-agent-secret")):
        auth = request.headers.get("authorization", "")
        token = auth.replace("Bearer ", "").strip()
        if not token:
            raise HTTPException(401, "Não autorizado")

    if wait:
        counts = await _run_kb_sync()
        return {"ok": True, "status": "completed", "counts": counts}

    background_tasks.add_task(_run_kb_sync)
    return {"ok": True, "status": "sync_started"}


@app.post("/v1/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "").strip()
    payload = verify_jwt(token) if token else None
    if not payload and not verify_agent_secret(request.headers.get("x-agent-secret")):
        raise HTTPException(401, "Não autorizado")

    user_id = resolve_user_id(payload)
    check_rate(str(user_id))

    ok, guarded_msg, block_reason, injection = guard_input(body.message)
    if not ok:
        emit_security_event(
            {
                "userId": user_id,
                "conversationId": body.conversation_id,
                "severity": injection.severity if injection else "alta",
                "pattern": injection.pattern if injection else None,
                "blocked": True,
                "promptSnippet": body.message[:500],
            }
        )
        conv_id = body.conversation_id or str(__import__("uuid").uuid4())
        blocked = _blocked_response(block_reason or "Solicitação bloqueada.")
        usage = _empty_usage()
        return ChatResponse(
            conversation_id=conv_id,
            response=blocked,
            usage=usage,
            session_usage=usage,
        )

    if body.conversation_id and token:
        api = HelpdeskApi(token)
        if not await api.conversation_owned(body.conversation_id):
            raise HTTPException(403, "Conversa não encontrada ou sem permissão.")

    started = time.time()
    checkpointer = await ensure_checkpointer_ready()
    store = await ensure_store_ready()
    with span_chat_turn(
        user_id=str(user_id),
        conversation_id=body.conversation_id,
        analysis_type=body.analysis_type,
    ) as otel_span:
        try:
            conv_id, mixed, turn_usage, session_usage, audit_meta = await run_chat(
                guarded_msg,
                body.conversation_id,
                str(user_id),
                checkpointer,
                store,
                session_input=body.session_input_tokens,
                session_output=body.session_output_tokens,
                session_cost=body.session_cost_usd,
                session_turns=body.session_turns,
                knowledge_mode=body.knowledge_mode,
                analysis_type=body.analysis_type,
                attachment_ids=body.attachment_ids or None,
                bearer_token=token or None,
            )
            try:
                await HelpdeskApi().audit({
                    "userId": user_id,
                    "conversationId": conv_id,
                    "question": body.message[:500],
                    "analysisType": body.analysis_type,
                    "modelUsed": f"{turn_usage.provider}/{turn_usage.model}",
                    "latencyMs": int((time.time() - started) * 1000),
                    "toolsCalled": audit_meta.get("toolsCalled") or [],
                    "route": audit_meta.get("route"),
                    "recordsReturned": audit_meta.get("recordsReturned"),
                    "sources": audit_meta.get("sources"),
                })
            except Exception:
                pass
            audit_meta["mixed"] = mixed
            latency_ms = int((time.time() - started) * 1000)
            record_turn_metrics(
                otel_span,
                route=audit_meta.get("route"),
                latency_ms=latency_ms,
                input_tokens=turn_usage.input_tokens,
                output_tokens=turn_usage.output_tokens,
                estimated_cost_usd=turn_usage.estimated_cost_usd,
                model=turn_usage.model,
                provider=turn_usage.provider,
                user_message=body.message,
                assistant_output=mixed.markdown,
            )
            _emit_turn_governance(
                user_id=user_id,
                conversation_id=conv_id,
                body=body,
                audit_meta=audit_meta,
                turn_usage=turn_usage,
                latency_ms=latency_ms,
                markdown=mixed.markdown,
            )
            return ChatResponse(
                conversation_id=conv_id,
                response=mixed,
                usage=turn_usage,
                session_usage=session_usage,
            )
        except Exception as e:
            try:
                await HelpdeskApi().audit({
                    "userId": user_id,
                    "conversationId": body.conversation_id,
                    "question": body.message[:500],
                    "analysisType": body.analysis_type,
                    "error": str(e)[:500],
                    "latencyMs": int((time.time() - started) * 1000),
                })
            except Exception:
                pass
            latency_ms = int((time.time() - started) * 1000)
            record_turn_metrics(
                otel_span,
                route=None,
                latency_ms=latency_ms,
                user_message=body.message,
                error=str(e)[:500],
            )
            _emit_turn_governance(
                user_id=user_id,
                conversation_id=body.conversation_id,
                body=body,
                audit_meta={},
                turn_usage=None,
                latency_ms=latency_ms,
                error=str(e)[:500],
            )
            raise HTTPException(500, f"Erro no agente: {e}") from e


@app.post("/v1/chat/stream")
async def chat_stream(body: ChatRequest, request: Request):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "").strip()
    payload = verify_jwt(token) if token else None
    if not payload and not verify_agent_secret(request.headers.get("x-agent-secret")):
        raise HTTPException(401, "Não autorizado")

    user_id = resolve_user_id(payload)
    check_rate(str(user_id))

    ok, guarded_msg, block_reason, injection = guard_input(body.message)
    if not ok:
        emit_security_event(
            {
                "userId": user_id,
                "conversationId": body.conversation_id,
                "severity": injection.severity if injection else "alta",
                "pattern": injection.pattern if injection else None,
                "blocked": True,
                "promptSnippet": body.message[:500],
            }
        )
        conv_id = body.conversation_id or str(__import__("uuid").uuid4())
        blocked = _blocked_response(block_reason or "Solicitação bloqueada.")
        usage = _empty_usage()

        async def blocked_gen():
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv_id, 'response': blocked.model_dump(), 'usage': usage.model_dump(), 'session_usage': usage.model_dump()}, ensure_ascii=False)}\n\n"

        return StreamingResponse(blocked_gen(), media_type="text/event-stream")

    if body.conversation_id and token:
        api = HelpdeskApi(token)
        if not await api.conversation_owned(body.conversation_id):
            raise HTTPException(403, "Conversa não encontrada ou sem permissão.")

    checkpointer = await ensure_checkpointer_ready()
    store = await ensure_store_ready()
    started = time.time()

    async def event_gen():
        audit_meta: dict = {}
        turn_usage: TokenUsageTurn | None = None
        conv_id: str | None = body.conversation_id
        with span_chat_turn(
            user_id=str(user_id),
            conversation_id=body.conversation_id,
            analysis_type=body.analysis_type,
            stream=True,
        ) as otel_span:
            try:
                async for item in run_chat_stream(
                    guarded_msg,
                    body.conversation_id,
                    str(user_id),
                    checkpointer,
                    store,
                    session_input=body.session_input_tokens,
                    session_output=body.session_output_tokens,
                    session_cost=body.session_cost_usd,
                    session_turns=body.session_turns,
                    knowledge_mode=body.knowledge_mode,
                    analysis_type=body.analysis_type,
                    attachment_ids=body.attachment_ids or None,
                    bearer_token=token or None,
                ):
                    if isinstance(item, dict) and item.get("__final__"):
                        mixed = item["mixed"]
                        turn = item["turn_usage"]
                        turn_usage = turn
                        session = item["session_usage"]
                        conv_id = item["thread_id"]
                        audit_meta = item.get("audit_meta") or {}
                        audit_meta["mixed"] = mixed
                        yield f"data: {json.dumps({'type': 'done', 'conversation_id': item['thread_id'], 'response': mixed.model_dump(), 'usage': turn.model_dump(), 'session_usage': session.model_dump()}, ensure_ascii=False)}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'token', 'token': item}, ensure_ascii=False)}\n\n"
                try:
                    await HelpdeskApi().audit({
                        "userId": user_id,
                        "conversationId": conv_id,
                        "question": body.message[:500],
                        "analysisType": body.analysis_type,
                        "latencyMs": int((time.time() - started) * 1000),
                        "toolsCalled": audit_meta.get("toolsCalled") or [],
                        "route": audit_meta.get("route"),
                        "recordsReturned": audit_meta.get("recordsReturned"),
                        "sources": audit_meta.get("sources"),
                    })
                except Exception:
                    pass
                _emit_turn_governance(
                    user_id=user_id,
                    conversation_id=conv_id,
                    body=body,
                    audit_meta=audit_meta,
                    turn_usage=turn_usage,
                    latency_ms=int((time.time() - started) * 1000),
                    markdown=getattr(audit_meta.get("mixed"), "markdown", None),
                )
                if otel_span and turn_usage:
                    mixed = audit_meta.get("mixed")
                    record_turn_metrics(
                        otel_span,
                        route=audit_meta.get("route"),
                        latency_ms=int((time.time() - started) * 1000),
                        input_tokens=turn_usage.input_tokens,
                        output_tokens=turn_usage.output_tokens,
                        estimated_cost_usd=turn_usage.estimated_cost_usd,
                        model=turn_usage.model,
                        provider=turn_usage.provider,
                        user_message=body.message,
                        assistant_output=getattr(mixed, "markdown", None) if mixed else None,
                    )
            except Exception as e:
                if otel_span:
                    record_turn_metrics(
                        otel_span,
                        route=None,
                        latency_ms=int((time.time() - started) * 1000),
                        user_message=body.message,
                        error=str(e)[:500],
                    )
                _emit_turn_governance(
                    user_id=user_id,
                    conversation_id=conv_id,
                    body=body,
                    audit_meta={},
                    turn_usage=None,
                    latency_ms=int((time.time() - started) * 1000),
                    error=str(e)[:500],
                )
                yield f"data: {json.dumps({'type': 'error', 'error': friendly_llm_error(str(e))}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
