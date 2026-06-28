# Agente conversacional IA — Legal AI Workspace

## Arquitetura

| Serviço | Porta | Função |
|---------|-------|--------|
| `frontend` | 3000 | Chat UI, admin, BFF (`/api/agent/*`) |
| `backend` | 8000 | Auth, conversas, anexos, KB, BYOK |
| `ai-agent` | 8100 | LangGraph Deep Agent + VFS RAG 3.0 |

O agente **não inventa** leis ou jurisprudência. Em modo documental, consulta arquivos em `/legal-kb/` via filesystem virtual (grep, read_file, ls). Anexos da conversa atual têm **prioridade** sobre a base global.

## Fluxo de chat

```
Usuário → BFF /api/agent/chat/stream
       → backend: valida conversa (ownership)
       → ai-agent: POST /v1/chat/stream
       → LangGraph (checkpointer Postgres)
       → resposta MixedResponse (SSE tokens + done)
       → backend: persiste mensagem assistant
```

Validações de segurança:
- BFF chama `GET /conversations/:id` antes de reutilizar `conversationId`
- Agente chama `conversation_owned()` via JWT antes de usar thread existente
- Anexos: backend valida `uploadedByUserId` ou conversa do usuário

## Variáveis (Railway / docker-compose)

### Backend
- `AUTH_SECRET` — JWT (mesmo valor frontend + ai-agent)
- `API_SECRET` — BFF → backend
- `AGENT_SERVICE_SECRET` — ai-agent → `/api/v1/internal/llm/active`
- `CREDENTIALS_ENCRYPTION_KEY` — BYOK AES-256-GCM
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — seed admin
- `STORAGE_PATH` — `/data/storage` (+ volume Railway)

### Frontend
- `API_URL`, `AI_AGENT_URL`, `API_SECRET`, `AUTH_SECRET`

### AI Agent
- `DATABASE_URL` — checkpointer LangGraph (mesmo Postgres)
- `BACKEND_INTERNAL_URL` — URL backend (preferir interna Railway)
- `API_SECRET`, `AGENT_SERVICE_SECRET`, `AUTH_SECRET`
- `KB_VFS_PATH` — default `/legal-kb/`
- `AGENT_RECURSION_LIMIT` — default 100
- `RATE_LIMIT_PER_MINUTE` — default 30

## Tipos de análise (`analysis_type`)

Definidos em `ai-agent/app/deep_prompts.py`:

| ID | Descrição |
|----|-----------|
| `geral` | Consulta jurídica geral |
| `revisao_gramatical` | Revisão gramatical e clareza |
| `revisao_juridica` | Revisão de cláusulas e termos |
| `analise_riscos` | Riscos contratuais e operacionais |
| `criacao_contrato` | Estruturação/criação de contrato |
| `resumo_executivo` | Resumo executivo |
| `extracao_obrigacoes` | Obrigações das partes |
| `identificacao_partes` | Partes e qualificação |
| `identificacao_prazos` | Prazos e marcos |
| `clausulas_sensiveis` | Cláusulas sensíveis |
| `comparacao_versoes` | Comparação entre versões |
| `sugestao_clausulas` | Sugestão de cláusulas |
| `minuta` | Minuta preliminar |

UI expõe subset em `AgentChat.tsx` (6 opções principais).

## Contrato de resposta (`MixedResponse`)

```python
# ai-agent/app/schemas.py
markdown: str
charts: list[ChartSpec]
kpis: list[KpiSpec]
tables: list[dict]
sources: list[ResponseSource]  # knowledge | system | hybrid
insights, follow_ups, data_limitations, route
```

Frontend renderiza via `AgentMarkdown.tsx`, `AgentMessage.tsx`.

## RAG / Base de conhecimento

1. Admin faz upload → backend extrai texto → status `ready`
2. `notifyVfsSync()` → ai-agent `/v1/kb/sync`
3. Documentos viram arquivos em VFS (`/legal-kb/{id}.md`)
4. Agente lista/busca/lê via Deep Agent backend

PDF na KB: OpenAI (`gpt-4o` OCR página a página se necessário).  
Anexo de chat: extração síncrona no upload, **sem** criar `KnowledgeDocument`.

## LLM

| Função | Provedor | Resolução |
|--------|----------|-----------|
| Chat / análises | Anthropic | `GET /api/v1/internal/llm/active` + provider anthropic |
| Extração PDF | OpenAI | Config admin OpenAI ou bootstrap `OPENAI_API_KEY` |

## Subagente researcher

Prompt em `build_researcher_system_prompt`. Máx. 4 tool calls. Relatório interno — não exposto ao usuário (filtro em `_extract_final_text`).

## Endpoints ai-agent

| Método | Path | Auth |
|--------|------|------|
| GET | `/health` | público |
| POST | `/v1/chat/stream` | JWT ou agent secret |
| POST | `/v1/chat` | JWT ou agent secret |
| POST | `/v1/kb/sync` | agent secret ou JWT |
| GET | `/v1/kb/status` | agent secret |

## Arquivos-chave

| Arquivo | Responsabilidade |
|---------|------------------|
| `ai-agent/app/graph.py` | Orquestração chat/stream |
| `ai-agent/app/main.py` | FastAPI, rate limit, ownership |
| `ai-agent/services/helpdesk_api.py` | Cliente HTTP → backend |
| `ai-agent/services/kb_vfs_sync.py` | Sync documentos → VFS |
| `ai-agent/services/intent_router.py` | Roteamento documental/hybrid |
| `ai-agent/app/deep_prompts.py` | System prompts jurídicos |
| `backend/src/routes/agent-conversations.ts` | Persistência conversas |
| `frontend/src/app/api/agent/chat/stream/route.ts` | BFF streaming |

## Deploy

Ver [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md). Agente compartilha Postgres com backend para checkpoints LangGraph.
