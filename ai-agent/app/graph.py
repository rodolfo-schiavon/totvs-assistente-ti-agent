import asyncio
import ast
import json
import logging
import os
import re
import uuid

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.errors import GraphRecursionError

from services.prompt_registry import (
    build_main_system_prompt,
    build_researcher_system_prompt,
    action_tools_prompt_suffix,
)
from services.action_broker_client import action_tools_for_route
from services.mcp_client import build_mcp_preflight_context, mcp_tools_for_route
from app.llm_provider import build_llm
from app.schemas import MixedResponse, TokenUsageTurn
from app.vfs_backend import KB_VFS_PATH, build_vfs_backend
from services.helpdesk_api import HelpdeskApi
from services.intent_router import RouteDecision, route_query
from services.document_citations import prepare_documental_response
from services.kb_vfs_sync import ensure_vfs_populated
from services.knowledge_registry import search_platform_docs
from services.vfs_search import build_vfs_search_hints
from services.llm_resolver import fetch_active_llm
from services.response_builder import build_mixed_response
from services.token_usage import compute_turn_usage
from services.tool_observability import estimate_records_from_tools, extract_tool_calls

logger = logging.getLogger(__name__)

# LangGraph usa 25 por padrão no invoke se não for definido explicitamente
AGENT_RECURSION_LIMIT = int(os.getenv("AGENT_RECURSION_LIMIT", "100"))
CHAT_STREAM_TIMEOUT_SEC = int(os.getenv("CHAT_STREAM_TIMEOUT_SEC", "300"))
ATTACHMENT_RECURSION_LIMIT = int(os.getenv("ATTACHMENT_RECURSION_LIMIT", "30"))


def _extract_ai_text(content: object) -> str:
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "\n".join(p for p in parts if p).strip()
    if isinstance(content, str):
        stripped = content.strip()
        if stripped.startswith("[") and ("'type'" in stripped or '"type"' in stripped):
            for parser in (json.loads, ast.literal_eval):
                try:
                    parsed = parser(stripped)
                    if isinstance(parsed, list):
                        return _extract_ai_text(parsed)
                except (ValueError, SyntaxError, json.JSONDecodeError):
                    continue
        return content
    return str(content)


def _looks_like_tool_json(text: str) -> bool:
    t = text.strip()
    return t.startswith("{") and ("tool" in t.lower() or "function" in t.lower())


_TOOL_XML_BLOCK_RE = re.compile(r"<function_calls>.*?</function_calls>", re.I | re.DOTALL)
_TOOL_XML_TAG_RE = re.compile(r"</?(?:invoke|parameter|function_calls)[^>]*>", re.I)


def _looks_like_tool_xml(text: str) -> bool:
    t = text.strip().lower()
    return "<function_calls>" in t or "<invoke" in t or "</parameter>" in t


def _strip_tool_xml(text: str) -> str:
    cleaned = _TOOL_XML_BLOCK_RE.sub("", text)
    cleaned = _TOOL_XML_TAG_RE.sub("", cleaned)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def _is_tool_planning_chatter(text: str) -> bool:
    """Raciocínio intermediário de tool-calling — não deve ir para o usuário."""
    t = text.strip().lower()
    if not t:
        return True
    if _looks_like_tool_json(text) or _looks_like_tool_xml(text):
        return True
    markers = (
        "deixe-me ",
        "vou criar",
        "vou estruturar",
        "vou tentar",
        "tentar novamente",
        "sintaxe correta",
        "parâmetro content",
        "parametro content",
        "abordagem correta",
        "chamada com o parâmetro",
        "use a abordagem",
    )
    if len(t) < 400 and any(m in t for m in markers):
        return True
    return False


def _should_stream_token(event: dict, text: str) -> bool:
    if not text.strip() or _is_tool_planning_chatter(text):
        return False
    if _is_internal_researcher_report(text):
        return False
    meta = event.get("metadata") or {}
    ns = str(meta.get("checkpoint_ns") or "").lower()
    node = str(meta.get("langgraph_node") or "").lower()
    if "researcher" in ns or "researcher" in node:
        return False
    return True


def _enrich_for_analysis_type(
    enriched: str, analysis_type: str, attachment_ids: list[str] | None
) -> str:
    if not attachment_ids:
        return enriched
    if analysis_type in ("runbook", "recomendacoes"):
        return enriched + (
            "\n\n[Instrução: produza o runbook ou checklist operacional COMPLETO diretamente na resposta em Markdown. "
            "Inclua pré-requisitos, passos numerados, validações e rollback. "
            "Use o conteúdo dos anexos acima quando relevante. "
            "NÃO use write_file/edit_file nem delegue ao researcher — "
            "entregue o procedimento estruturado no texto da resposta.]"
        )
    return enriched


def _pick_response_text(collected: list[str], final_messages: list) -> str:
    streamed = "".join(collected).strip()
    extracted = _extract_final_text(final_messages)
    if extracted and (not streamed or _is_tool_planning_chatter(streamed) or len(extracted) >= len(streamed)):
        return extracted
    return streamed or extracted


def _is_internal_researcher_report(text: str) -> bool:
    """Relatório do subagente researcher — não é resposta ao usuário."""
    low = text.lower()
    markers = (
        "achados principais",
        "evidências com paths",
        "evidencia com paths",
        "pontos de incerteza",
        "não responda diretamente ao usuário",
        "nao responda diretamente ao usuario",
    )
    return sum(1 for m in markers if m in low) >= 2


def _extract_final_text(messages: list) -> str:
    """Extrai texto final do agente principal (não relatórios internos do researcher)."""
    for m in reversed(messages):
        if isinstance(m, AIMessage) and m.content:
            text = _strip_tool_xml(_extract_ai_text(m.content).strip())
            if text and not _looks_like_tool_json(text) and not _is_internal_researcher_report(text) and not _is_tool_planning_chatter(text):
                return text

    best_tool = ""
    for m in reversed(messages):
        if not isinstance(m, ToolMessage) or not m.content:
            continue
        text = m.content if isinstance(m.content, str) else str(m.content)
        if "Error:" in text[:120]:
            continue
        if _is_internal_researcher_report(text):
            continue
        if "no matches found" in text.lower() and len(text) < 400:
            continue
        if len(text) > len(best_tool):
            best_tool = text
    return best_tool[:200_000].strip()


_DOCUMENT_ANALYSIS_TYPES = frozenset({"runbook", "recomendacoes", "diagnostico"})

_CONTINUE_DOC_PROMPT = (
    "A resposta anterior foi interrompida antes de concluir o procedimento. "
    "Continue EXATAMENTE de onde parou — sem repetir passos já escritos. "
    "Complete todas as seções restantes até o fim (validação, rollback, referências). "
    "Entregue somente a continuação em Markdown."
)


def _hit_max_tokens(messages: list) -> bool:
    for m in reversed(messages):
        if not isinstance(m, AIMessage):
            continue
        meta = getattr(m, "response_metadata", None) or {}
        if meta.get("stop_reason") == "max_tokens" or meta.get("finish_reason") == "max_tokens":
            return True
    return False


def _looks_truncated_document(text: str, analysis_type: str, messages: list | None = None) -> bool:
    if messages and _hit_max_tokens(messages):
        return True
    if analysis_type not in _DOCUMENT_ANALYSIS_TYPES and not (text and len(text) > 8000):
        return False
    t = text.strip()
    if len(t) < 1500:
        return False
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    for ln in lines[-2:]:
        if re.match(r"^#+\s*\d+", ln):
            return True
        if re.match(r"^\d+\.\d+[\s.]", ln) and len(ln) < 100:
            return True
    if len(t) > 6000 and not re.search(r"[.!?\"'»)\]]\s*$", t):
        return True
    tail = t[-800].lower()
    closing_markers = (
        "assinatura",
        "foro",
        "disposições gerais",
        "disposicoes gerais",
        "testemunhas",
        "e por estarem",
    )
    if len(t) > 8000 and not any(m in tail for m in closing_markers):
        return True
    return False


async def _continue_document_if_needed(
    agent,
    body: str,
    config: dict,
    analysis_type: str,
    max_continuations: int = 2,
) -> tuple[str, list]:
    messages: list = []
    for i in range(max_continuations):
        if not _looks_truncated_document(body, analysis_type, messages or None):
            break
        logger.info("document output appears truncated — continuation round %s", i + 1)
        tail = body[-2500:] if len(body) > 2500 else body
        prompt = f"{_CONTINUE_DOC_PROMPT}\n\nÚltimo trecho produzido:\n```\n{tail}\n```"
        extra, messages = await _invoke_deep_agent(agent, prompt, config, max_rounds=1)
        if not extra or len(extra.strip()) < 40:
            break
        if extra.strip() in body:
            break
        body = f"{body.rstrip()}\n\n{extra.strip()}"
    return body, messages


def _normalize_kb_message(
    message: str, knowledge_mode: bool, attachment_ids: list[str] | None = None
) -> str:
    if not knowledge_mode or attachment_ids:
        return message
    low = message.lower().strip()
    generic_markers = (
        "conversar com documentos",
        "documentos da base",
        "base de conhecimento",
        "modo documentos",
    )
    if any(m in low for m in generic_markers) and len(low) < 150:
        return (
            "Liste os documentos em /platform-kb/, resuma o conteúdo principal de cada um "
            "e cite os paths dos arquivos fonte."
        )
    return message


async def _prepare_vfs_context(
    store,
    route: str | None,
    knowledge_mode: bool,
    attachment_ids: list[str] | None = None,
) -> tuple[str, list[dict]]:
    if attachment_ids:
        return "", []
    if not (knowledge_mode or route in ("documental", "hybrid")):
        return "", []
    files = await ensure_vfs_populated(store)
    return _vfs_preflight_block(files), files


_SYNTHESIS_NUDGE = (
    "Com base no relatório interno do researcher e nas leituras VFS, "
    "escreva a resposta FINAL ao usuário em português claro e direto.\n"
    "Regras da resposta final:\n"
    "- NÃO repita o formato do researcher (Achados/Evidências/Pontos de incerteza)\n"
    "- NÃO inclua paths `/platform-kb/...` nem números de linha no texto\n"
    "- Responda como um assistente falando com o usuário (bullets ou parágrafos curtos)\n"
    "- As fontes serão anexadas automaticamente; foque no conteúdo e nos números/regras"
)


async def _enrich_for_documental(
    store,
    enriched: str,
    message: str,
    knowledge_mode: bool,
    route: str | None,
    attachment_ids: list[str] | None = None,
) -> str:
    if attachment_ids:
        return enriched
    if not (knowledge_mode or route in ("documental", "hybrid")):
        return enriched
    hints = await build_vfs_search_hints(store, message)
    kr = search_platform_docs(message)
    if kr:
        hints = (hints or "") + f"\n\n[Knowledge Registry — trechos relevantes]\n{kr}"
    if not hints:
        return enriched
    guide = (
        "\n\n[Instrução: a DICA acima já indica linhas relevantes — "
        "use read_file(offset, limit) nessas linhas e responda. "
        "Evite delegar ao researcher em perguntas específicas; máximo 3 tool calls.]"
    )
    return enriched + hints + guide


async def _invoke_deep_agent(agent, enriched: str, config: dict, max_rounds: int = 2) -> tuple[str, list]:
    """Executa o Deep Agent até obter resposta textual (continua se parar só em tool calls)."""
    inputs: dict = {"messages": [HumanMessage(content=enriched)]}
    messages: list = []

    for round_idx in range(max_rounds):
        try:
            result = await agent.ainvoke(inputs, config=config)
        except GraphRecursionError:
            raise
        messages = result.get("messages", [])
        text = _extract_final_text(messages)
        if text:
            return text, messages

        last = messages[-1] if messages else None
        has_tool_activity = any(
            isinstance(m, ToolMessage) for m in messages[-8:]
        ) or (isinstance(last, AIMessage) and last.tool_calls)

        if not has_tool_activity:
            break

        logger.warning(
            "deep agent round %s terminou sem texto — solicitando síntese",
            round_idx + 1,
        )
        inputs = {"messages": [HumanMessage(content=_SYNTHESIS_NUDGE)]}

    return _extract_final_text(messages), messages


def _friendly_agent_error(exc: Exception) -> str:
    if isinstance(exc, asyncio.TimeoutError):
        return (
            "O processamento demorou demais (limite de tempo). "
            "Tente uma pergunta mais específica, menos anexos por vez, ou inicie uma nova conversa."
        )
    if isinstance(exc, GraphRecursionError) or "recursion limit" in str(exc).lower():
        return (
            "A consulta exigiu muitas etapas de busca no documento e atingiu o limite de segurança. "
            "Tente uma pergunta mais específica (ex.: «o que é um terreno no Magic?») ou inicie uma nova conversa."
        )
    return str(exc)[:500]


def _vfs_preflight_block(files: list[dict]) -> str:
    if not files:
        return (
            f"\n\n[AVISO SISTEMA: o VFS `{KB_VFS_PATH}` está vazio — "
            "nenhum documento sincronizado. Informe ao usuário que a base ainda não foi "
            "indexada no agente e sugira reindexar no admin ou aguardar sync.]"
        )
    lines = [f"- {f['path']}" for f in files[:30]]
    return (
        f"\n\n[Documentos disponíveis em `{KB_VFS_PATH}` ({len(files)} arquivo(s)):\n"
        + "\n".join(lines)
        + "\nUse ls/grep/read_file ou delegue ao researcher.]"
    )


def _prior_human_from_messages(messages: list) -> list[str]:
    out: list[str] = []
    for m in reversed(messages):
        if isinstance(m, HumanMessage) and m.content:
            text = m.content if isinstance(m.content, str) else str(m.content)
            if "---" in text:
                text = text.split("---")[0].strip()
            out.append(text)
            if len(out) >= 4:
                break
    return out


async def build_agent(
    checkpointer=None,
    store=None,
    llm_cfg: dict | None = None,
    allowed_tool_names: list[str] | None = None,
    route: str | None = None,
    knowledge_mode: bool = False,
    analysis_type: str = "geral",
    user_id: str | None = None,
    conversation_id: str | None = None,
):
    cfg = llm_cfg or await fetch_active_llm()
    primary = cfg.get("primary") or cfg
    llm = build_llm(primary, analysis_type=analysis_type)
    tools = mcp_tools_for_route(route or "operational")
    if user_id:
        tools = [*tools, *action_tools_for_route(route or "operational", user_id, conversation_id)]

    researcher = {
        "name": "researcher",
        "description": (
            "Especialista em documentação da plataforma; localiza runbooks e specs em /platform-kb/."
        ),
        "system_prompt": build_researcher_system_prompt(KB_VFS_PATH),
    }

    system = build_main_system_prompt(kb_path=KB_VFS_PATH) + action_tools_prompt_suffix(route)
    agent = create_deep_agent(
        model=llm,
        tools=tools,
        backend=build_vfs_backend,
        subagents=[researcher],
        system_prompt=system,
        checkpointer=checkpointer,
        store=store,
    )
    return agent, primary


async def _prepare_message(
    message: str, attachment_ids: list[str] | None, bearer_token: str | None = None
) -> str:
    return await _enrich_message(message, attachment_ids, bearer_token)


async def _enrich_message(
    message: str, attachment_ids: list[str] | None, bearer_token: str | None = None
) -> str:
    if not attachment_ids:
        return message
    api = HelpdeskApi(bearer_token)
    parts: list[str] = []
    try:
        for attempt in range(30):
            ctx = await api.attachment_context(attachment_ids)
            parts = []
            pending = False
            for a in ctx.get("attachments", []):
                name = a.get("fileName", "anexo")
                text = a.get("extractedText")
                if text and str(text).strip():
                    parts.append(f"[Anexo: {name}]\n{str(text).strip()[:50000]}")
                else:
                    pending = True
                    parts.append(f"[Anexo: {name}] (texto ainda não disponível — aguarde e reenvie)")
            if not pending or attempt >= 29:
                break
            await asyncio.sleep(2)

        if parts:
            header = (
                "---\nContexto dos anexos DESTA conversa (prioridade sobre a base /platform-kb/):\n"
                "Responda com base no conteúdo abaixo. Não diga que o arquivo está em processamento "
                "se o texto do anexo já estiver presente.\n"
            )
            return f"{message}\n\n{header}" + "\n\n".join(parts)
    except Exception as e:
        logger.warning("attachment_context failed: %s", e)
    return message


def _build_config(
    thread_id: str,
    user_id: str,
    knowledge_mode: bool,
    attachment_ids: list[str] | None,
    route_decision: RouteDecision,
    analysis_type: str = "geral",
) -> dict:
    tags = ["assistente-ti", "platform-agent", "rag:vfs3", f"route:{route_decision.route}"]
    recursion = AGENT_RECURSION_LIMIT
    if attachment_ids or analysis_type in ("runbook", "recomendacoes"):
        recursion = min(ATTACHMENT_RECURSION_LIMIT, AGENT_RECURSION_LIMIT)
    return {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": recursion,
        "run_name": "assistente_ti_deep_agent_chat",
        "tags": tags,
        "metadata": {
            "user_id": user_id,
            "conversation_id": thread_id,
            "knowledge_mode": knowledge_mode,
            "has_attachments": bool(attachment_ids),
            "route": route_decision.route,
            "route_confidence": route_decision.confidence,
            "route_reasoning": route_decision.reasoning,
        },
    }


def _extract_pending_actions(messages: list) -> list[dict]:
    out: list[dict] = []
    for m in messages:
        if not isinstance(m, ToolMessage) or not m.content:
            continue
        text = m.content if isinstance(m.content, str) else str(m.content)
        if "action_id" not in text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            continue
        aid = data.get("action_id")
        if aid:
            out.append(
                {
                    "id": aid,
                    "action_type": data.get("action_type", ""),
                    "summary": data.get("summary", ""),
                    "risk": data.get("risk", "medium"),
                    "status": data.get("status", "pending"),
                    "expires_at": data.get("expires_at"),
                }
            )
    return out


async def _finalize_response(
    message: str,
    last_ai: str,
    messages: list,
    route_decision: RouteDecision,
    vfs_files: list[dict] | None = None,
    attachment_ids: list[str] | None = None,
    bearer_token: str | None = None,
) -> MixedResponse:
    api = HelpdeskApi(bearer_token)
    tool_names = extract_tool_calls(messages)
    fallback = last_ai
    attachment_docs: list[str] = []
    if attachment_ids:
        try:
            ctx = await api.attachment_context(attachment_ids)
            attachment_docs = [
                str(a.get("fileName"))
                for a in ctx.get("attachments", [])
                if a.get("fileName")
            ]
        except Exception as e:
            logger.warning("attachment_context for finalize failed: %s", e)

    if not fallback:
        if (
            not attachment_ids
            and vfs_files is not None
            and len(vfs_files) == 0
            and route_decision.route in ("documental", "hybrid")
        ):
            fallback = (
                "A base documental ainda não foi sincronizada com o agente (VFS vazio). "
                "Peça ao administrador para reindexar os documentos em **Admin → Base de conhecimento** "
                "e aguardar o status **synced**."
            )
        elif vfs_files:
            paths = ", ".join(f["path"] for f in vfs_files[:8])
            fallback = (
                f"Há {len(vfs_files)} documento(s) na base ({paths}), "
                "mas não consegui gerar a resposta. Tente perguntar sobre um documento específico."
            )
        else:
            fallback = "Não encontrei dados suficientes para responder com segurança."

    body, doc_names = prepare_documental_response(
        fallback, messages, vfs_files, route_decision.route
    )
    documents = attachment_docs or doc_names

    mixed = await build_mixed_response(
        message,
        body,
        api,
        history_messages=messages,
        route=route_decision.route,
        tool_names=tool_names,
        kb_prefetch=False,
        documents=documents,
        has_attachments=bool(attachment_ids),
    )
    pending = _extract_pending_actions(messages)
    if pending:
        mixed.pending_actions = pending
    return mixed


async def run_chat(
    message: str,
    conversation_id: str | None,
    user_id: str,
    checkpointer,
    store,
    session_input: int = 0,
    session_output: int = 0,
    session_cost: float = 0.0,
    session_turns: int = 0,
    knowledge_mode: bool = False,
    analysis_type: str = "geral",
    attachment_ids: list[str] | None = None,
    bearer_token: str | None = None,
) -> tuple[str, MixedResponse, TokenUsageTurn, TokenUsageTurn, dict]:
    thread_id = conversation_id or str(uuid.uuid4())
    prior: list[str] = []
    if checkpointer and conversation_id:
        try:
            state = await checkpointer.aget({"configurable": {"thread_id": thread_id}})
            if state and state.get("channel_values", {}).get("messages"):
                prior = _prior_human_from_messages(state["channel_values"]["messages"])
        except Exception:
            pass

    route_decision = route_query(message, prior, knowledge_mode)
    logger.info(
        "route=%s confidence=%.2f reason=%s tools=%s",
        route_decision.route,
        route_decision.confidence,
        route_decision.reasoning,
        len(route_decision.allowed_tool_names),
    )

    vfs_hint, vfs_files = await _prepare_vfs_context(
        store, route_decision.route, knowledge_mode, attachment_ids
    )

    agent, primary = await build_agent(
        checkpointer,
        store,
        allowed_tool_names=route_decision.allowed_tool_names,
        route=route_decision.route,
        knowledge_mode=knowledge_mode,
        analysis_type=analysis_type,
        user_id=user_id,
        conversation_id=thread_id,
    )
    config = _build_config(thread_id, user_id, knowledge_mode, attachment_ids, route_decision, analysis_type)
    model = str(primary.get("model", "unknown"))
    provider = str(primary.get("provider", "unknown"))

    enriched = await _prepare_message(message, attachment_ids, bearer_token)
    enriched = _normalize_kb_message(enriched, knowledge_mode, attachment_ids)
    enriched = _enrich_for_analysis_type(enriched, analysis_type, attachment_ids)
    if vfs_hint:
        enriched = enriched + vfs_hint
    enriched = await _enrich_for_documental(
        store, enriched, message, knowledge_mode, route_decision.route, attachment_ids
    )
    if route_decision.route in ("operational", "analytical"):
        enriched = enriched + build_mcp_preflight_context(route_decision.route)

    try:
        last_ai, messages = await asyncio.wait_for(
            _invoke_deep_agent(agent, enriched, config),
            timeout=CHAT_STREAM_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError as e:
        raise RuntimeError(_friendly_agent_error(e)) from e
    except GraphRecursionError as e:
        logger.error("graph recursion limit: %s", e)
        raise RuntimeError(_friendly_agent_error(e)) from e

    if last_ai and (analysis_type in _DOCUMENT_ANALYSIS_TYPES or attachment_ids):
        continued, cont_messages = await _continue_document_if_needed(
            agent, last_ai, config, analysis_type
        )
        if continued != last_ai:
            last_ai = continued
            if cont_messages:
                messages = cont_messages

    usage_raw = compute_turn_usage(messages, model, provider, message)
    turn_usage = TokenUsageTurn(**usage_raw)
    session_usage = TokenUsageTurn(
        input_tokens=session_input + turn_usage.input_tokens,
        output_tokens=session_output + turn_usage.output_tokens,
        total_tokens=session_input + session_output + turn_usage.total_tokens,
        model=model,
        provider=provider,
        source=turn_usage.source,
        llm_calls=turn_usage.llm_calls,
        estimated_cost_usd=round(session_cost + turn_usage.estimated_cost_usd, 6),
    )

    mixed = await _finalize_response(
        message, last_ai, messages, route_decision, vfs_files, attachment_ids, bearer_token
    )
    audit_meta = {
        "route": route_decision.route,
        "toolsCalled": extract_tool_calls(messages),
        "recordsReturned": estimate_records_from_tools(messages) or len(vfs_files),
        "sources": [s.type for s in mixed.sources],
    }
    return thread_id, mixed, turn_usage, session_usage, audit_meta


async def run_chat_stream(
    message: str,
    conversation_id: str | None,
    user_id: str,
    checkpointer,
    store,
    session_input: int = 0,
    session_output: int = 0,
    session_cost: float = 0.0,
    session_turns: int = 0,
    knowledge_mode: bool = False,
    analysis_type: str = "geral",
    attachment_ids: list[str] | None = None,
    bearer_token: str | None = None,
):
    thread_id = conversation_id or str(uuid.uuid4())
    prior: list[str] = []
    if checkpointer and conversation_id:
        try:
            state = await checkpointer.aget({"configurable": {"thread_id": thread_id}})
            if state and state.get("channel_values", {}).get("messages"):
                prior = _prior_human_from_messages(state["channel_values"]["messages"])
        except Exception:
            pass

    route_decision = route_query(message, prior, knowledge_mode)
    vfs_hint, vfs_files = await _prepare_vfs_context(
        store, route_decision.route, knowledge_mode, attachment_ids
    )

    agent, primary = await build_agent(
        checkpointer,
        store,
        allowed_tool_names=route_decision.allowed_tool_names,
        route=route_decision.route,
        knowledge_mode=knowledge_mode,
        analysis_type=analysis_type,
        user_id=user_id,
        conversation_id=thread_id,
    )
    config = _build_config(thread_id, user_id, knowledge_mode, attachment_ids, route_decision, analysis_type)
    model = str(primary.get("model", "unknown"))
    provider = str(primary.get("provider", "unknown"))

    enriched = await _prepare_message(message, attachment_ids, bearer_token)
    enriched = _normalize_kb_message(enriched, knowledge_mode, attachment_ids)
    enriched = _enrich_for_analysis_type(enriched, analysis_type, attachment_ids)
    if vfs_hint:
        enriched = enriched + vfs_hint
    enriched = await _enrich_for_documental(
        store, enriched, message, knowledge_mode, route_decision.route, attachment_ids
    )
    if route_decision.route in ("operational", "analytical"):
        enriched = enriched + build_mcp_preflight_context(route_decision.route)

    use_invoke_path = bool(attachment_ids) or analysis_type in ("runbook", "recomendacoes")
    inputs: dict = {"messages": [HumanMessage(content=enriched)]}
    collected: list[str] = []
    final_messages: list = []

    try:
        if use_invoke_path:
            last_ai, final_messages = await asyncio.wait_for(
                _invoke_deep_agent(agent, enriched, config, max_rounds=2),
                timeout=CHAT_STREAM_TIMEOUT_SEC,
            )
        else:
            async def _collect_stream() -> None:
                nonlocal final_messages
                async for event in agent.astream_events(inputs, config=config, version="v2"):
                    kind = event.get("event")
                    if kind == "on_chat_model_stream":
                        chunk = event.get("data", {}).get("chunk")
                        if chunk and hasattr(chunk, "content") and chunk.content:
                            text = _extract_ai_text(chunk.content)
                            if text and _should_stream_token(event, text):
                                collected.append(text)
                    elif kind == "on_chain_end":
                        output = event.get("data", {}).get("output") or {}
                        if isinstance(output, dict) and output.get("messages"):
                            final_messages = output["messages"]

            await asyncio.wait_for(_collect_stream(), timeout=CHAT_STREAM_TIMEOUT_SEC)
            for text in collected:
                yield text
    except asyncio.TimeoutError as e:
        logger.error("chat stream timeout after %ss", CHAT_STREAM_TIMEOUT_SEC)
        raise RuntimeError(_friendly_agent_error(e)) from e
    except GraphRecursionError as e:
        logger.error("graph recursion limit: %s", e)
        raise RuntimeError(_friendly_agent_error(e)) from e

    if not final_messages:
        try:
            state = await agent.aget_state(config)
            final_messages = state.values.get("messages", []) if state else []
        except Exception:
            pass

    last_ai = _pick_response_text(collected, final_messages)

    if not last_ai:
        last = final_messages[-1] if final_messages else None
        has_tool_activity = any(
            isinstance(m, ToolMessage) for m in final_messages[-8:]
        ) or (isinstance(last, AIMessage) and getattr(last, "tool_calls", None))
        if has_tool_activity:
            try:
                last_ai, final_messages = await _invoke_deep_agent(
                    agent, _SYNTHESIS_NUDGE, config, max_rounds=1
                )
            except Exception as e:
                logger.warning("synthesis after stream failed: %s", e)
                last_ai = _extract_final_text(final_messages)
            if last_ai and not collected and not use_invoke_path:
                yield last_ai

    if last_ai and (analysis_type in _DOCUMENT_ANALYSIS_TYPES or attachment_ids):
        continued, cont_messages = await _continue_document_if_needed(
            agent, last_ai, config, analysis_type
        )
        if continued != last_ai:
            last_ai = continued
            if cont_messages:
                final_messages = cont_messages

    if use_invoke_path and last_ai:
        yield last_ai

    usage_raw = compute_turn_usage(final_messages, model, provider, message)
    turn_usage = TokenUsageTurn(**usage_raw)
    session_usage = TokenUsageTurn(
        input_tokens=session_input + turn_usage.input_tokens,
        output_tokens=session_output + turn_usage.output_tokens,
        total_tokens=session_input + session_output + turn_usage.total_tokens,
        model=model,
        provider=provider,
        source=turn_usage.source,
        llm_calls=turn_usage.llm_calls,
        estimated_cost_usd=round(session_cost + turn_usage.estimated_cost_usd, 6),
    )

    mixed = await _finalize_response(
        message, last_ai, final_messages, route_decision, vfs_files, attachment_ids, bearer_token
    )
    audit_meta = {
        "route": route_decision.route,
        "toolsCalled": extract_tool_calls(final_messages),
        "recordsReturned": estimate_records_from_tools(final_messages) or len(vfs_files),
        "sources": [s.type for s in mixed.sources],
    }
    yield {
        "__final__": True,
        "thread_id": thread_id,
        "mixed": mixed,
        "turn_usage": turn_usage,
        "session_usage": session_usage,
        "audit_meta": audit_meta,
    }
