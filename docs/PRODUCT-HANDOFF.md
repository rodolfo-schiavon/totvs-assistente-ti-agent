# Legal AI Workspace — Handoff de produto (estado atual)

Documento para **outra IA ou desenvolvedor** entender o que está implementado hoje e propor/evoluir funcionalidades com segurança.

**Última atualização:** 2026-06-09 · **Versão:** 2.7.1 · **Rollback:** tag `v2.6.0`

---

## 1. O que é

SaaS **single-tenant** de assistente jurídico interno para escritórios de advocacia:

- Chat com IA (streaming), histórico por usuário, anexos na conversa
- Base de conhecimento organizacional (upload → extração → RAG via VFS)
- BYOK: chaves OpenAI (extração) e Anthropic (chat) via painel admin
- Consentimento LGPD obrigatório, dashboard de uso, auditoria leve

**Não é:** parecer jurídico, multi-tenant em uma instância, DMS completo, integração processual (ainda).

---

## 2. Stack e repositório

```
legal-ai-workspace/
├── frontend/     Next.js 15, App Router, BFF em /api/*
├── backend/      Fastify, Prisma, PostgreSQL
├── ai-agent/     FastAPI, LangGraph, Deep Agents, VFS RAG 3.0
└── docs/
```

| Ambiente | Branch | Railway |
|----------|--------|---------|
| Produção | `production` | frontend, backend, ai-agent, Postgres |
| Staging | `develop` | idem |

URLs públicas:  
- **Produção:** `https://ia-dma.zerotouch.tec.br`  
- **Desenvolvimento:** `https://dev-ia-dma.zerotouch.tec.br`  
- Site institucional: `https://www.zerotouch.tec.br/` (fora deste deploy)

Fallback Railway (produção): `frontend-production-4f7b.up.railway.app` · DNS: [`DNS-CLOUDFLARE.md`](./DNS-CLOUDFLARE.md)

---

## 3. Fluxo do usuário

```
Login → /consent (1ª vez) → /dashboard/executive
                              ├── /dashboard/agent (chat)
                              ├── /dashboard/admin/governance/* (admin + gerencia)
                              └── /dashboard/admin/* (LLM/KB/usuários — só admin)
```

1. Login (`POST /api/auth/login`) → cookie `law_session`
2. Middleware Next.js valida JWT, consentimento e role
3. Chat: BFF `POST /api/agent/chat/stream` → cria/valida conversa no backend → stream no ai-agent → persiste mensagens

---

## 4. Perfis e permissões (implementado)

| Perfil | DB enum | Admin UI | Chat | KB | BYOK | Relatórios | Ver conversas alheias |
|--------|---------|----------|------|-----|------|------------|----------------------|
| admin | `admin` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| advogado | `advogado` | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| gerencia | `gerencia` | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ |
| gerencia/admin | — | Governança IA ✓ | — | — | — | ✓ (via Governança) | ✗ |

**Arquivos centrais:**
- `backend/src/core/roles.ts` — enum + `normalizeRole()` (compat JWT legado)
- `frontend/src/lib/roles.ts` — espelho frontend
- `backend/src/middleware/auth.ts` — `requireAdmin()`, `apiAuth`
- `backend/src/services/attachment-access.ts` — ownership de anexos
- `backend/src/routes/agent-conversations.ts` — CRUD filtrado por `userId`
- `frontend/src/middleware.ts` — guard `/dashboard/admin`, `/api/admin`
- `frontend/src/components/layout/sidebar.tsx` — admin nav só se `isAdmin`
- `ai-agent/app/main.py` — valida ownership da conversa antes do chat

**Pendente de produto (backlog):** ver seção 11 abaixo.

### 5.10 Conversation Intelligence Center (v2.7)

**UI:** `/dashboard/admin/conversations/*` — admin + gerencia

Submenus: Dashboard, Listagem, Busca, Segurança, Utilização, Compliance + detalhe `/[id]`.

**Pipeline:**
1. Mensagens persistidas em Prisma → jobs async (métricas, risco, embeddings)
2. Rollup 5 min → `ConversationMetrics` + `mv_conversation_daily`
3. Leitura → `GET /api/v1/conversation-intelligence/*` + BFF `/api/conversation-intelligence/*`
4. Visualização registrada em `ConversationView` + `ConversationAudit`

**Rollback:** tag `v2.6.0`

### 5.9 IA Observability & Governance Center (v2.6)

**UI:** `/dashboard/admin/governance/*` — admin + gerencia (`requireManagement()`)

Submenus: Visão Geral, Qualidade, Observabilidade, Custos, Segurança, Compliance, Analytics (Uso/Prompts/RAG/Modelos), Feedback, Alertas.

**Pipeline:**
1. Chat → `guard_input` (ai-agent) → LangGraph
2. Fire-and-forget → `POST /api/v1/internal/governance/ingest` (X-Agent-Secret)
3. Job agregação 5 min → rollups, MV `mv_governance_daily`, purge por `retentionDays`
4. Leitura → `GET /api/v1/governance/*` + BFF `/api/governance/*`

**Tabelas:** `LlmObservability`, `PromptAnalytics`, `PromptSecurityEvent`, `PromptQualityScore`, `RagMetrics`, `HallucinationEvent`, `LlmCostMetric`, `LlmFeedback`, `LlmAlert`, `AiGovernanceMetric`, `LgpdRequest`.

**Rollback:** tag `v2.5.0` antes deste módulo.

### 5.8 Relatórios gerenciais (v2.4 → redireciona para Governança > Custos)

**UI:** `/dashboard/management/reports` redireciona para `/dashboard/admin/governance/costs`

- KPIs: custo estimado, tokens, usuários/conversas ativos no período
- Tabela por usuário e por conversa (sem conteúdo das mensagens)
- Períodos: 7 / 30 / 90 dias
- API: `GET /api/v1/management/reports/usage?days=30`

### 5.9 Gestão de usuários — UI completa (v2.4)

- Editar perfil, ativo/inativo, redefinir senha, excluir
- BFF: `PATCH/DELETE /api/admin/users/[id]`

---

## 5. Módulos funcionais

### 5.1 Dashboard executivo (`/dashboard/executive`)

- KPIs: conversas, mensagens, documentos KB, latência média, tipos de análise
- API: `GET /api/v1/legal/dashboard` (via BFF `/api/legal/dashboard`)

### 5.2 Agente IA (`/dashboard/agent`)

**UI:** `frontend/src/components/agent/AgentChat.tsx`

- Streaming SSE via `/api/agent/chat/stream`
- Histórico recolhível (`AgentConversationList`)
- Tipos de análise (select): `geral`, `revisao_juridica`, `analise_riscos`, `criacao_contrato`, `resumo_executivo`, `minuta`
- Upload de anexos na conversa (extração síncrona, **não** indexa na KB global)
- Modo `knowledgeMode` — consulta base `/legal-kb/`
- Resposta: `MixedResponse` (markdown, charts, kpis, sources, follow_ups)

**Motor:** `ai-agent/app/graph.py`
- LangGraph + Deep Agent + subagente researcher
- Roteamento: `services/intent_router.py` (documental / hybrid / etc.)
- VFS: `services/kb_vfs_sync.py`, path `KB_VFS_PATH=/legal-kb/`
- Checkpointer PostgreSQL (mesmo `DATABASE_URL`)
- Prompts: `ai-agent/app/deep_prompts.py` — 13 `ANALYSIS_TYPES`

### 5.3 Base de conhecimento (admin)

**UI:** `frontend/src/app/(app)/dashboard/admin/knowledge/page.tsx`

- Upload PDF, DOCX, TXT, ODT
- Pipeline: `backend/src/knowledge/ingestion.ts`
- PDF: OpenAI (`openai-pdf.ts`) — OCR página a página se imagens; recusas detectadas e quarentena
- Status: `pending` → `ready` / `error`; VFS: `pending` → `synced`
- Sync: `POST /api/v1/knowledge/sync-vfs` → ai-agent `/v1/kb/sync`
- Storage: volume `/data/storage` (Railway)

### 5.4 BYOK / LLM (admin)

**UI:** `frontend/src/app/(app)/dashboard/admin/llm/page.tsx`

- Dois slots fixos: `openai` (extração), `anthropic` (chat)
- Catálogo: `frontend/src/lib/llm-models.ts`
- Backend: `backend/src/routes/llm-admin.ts`, cripto `credentials_crypto.ts`
- Agente lê config ativa: `GET /api/v1/internal/llm/active` (header `X-Agent-Secret`)

### 5.5 Usuários (admin)

**UI:** `frontend/src/app/(app)/dashboard/admin/users/page.tsx`

- CRUD: `backend/src/routes/users.ts`
- Senha mín. 8 caracteres

### 5.6 Consentimento LGPD

- Página `/consent`, APIs `consent/status`, `consent/accept`
- `WorkspaceSettings.retentionDays` (default 90)

### 5.7 Auditoria

- `AgentAuditLog`: conversationId, analysisType, latencyMs, tools, route (sem conteúdo integral)
- Agente POST `/api/v1/agent/audit` via `HelpdeskApi`

---

## 6. APIs principais

### Backend (`/api/v1/...`)

| Grupo | Endpoints | Auth |
|-------|-----------|------|
| Auth | `POST login`, `GET me` | login público |
| Consent | `GET status`, `POST accept` | JWT |
| Legal | `GET dashboard` | JWT |
| Conversas | CRUD `/agent/conversations` | JWT + userId |
| Anexos | `GET/POST attachments`, `GET .../file` | JWT + ownership |
| Knowledge | CRUD docs, sync-vfs, base | admin (exceto vfs-export: service) |
| Admin users | CRUD `/admin/users` | admin JWT |
| Admin LLM | CRUD configs, test-connection | admin JWT |
| Internal | `GET internal/llm/active` | `X-Agent-Secret` |
| Health | `GET health` | público |

### Frontend BFF (`/api/...`)

Proxy seguro com `API_SECRET` + JWT. Rotas espelham backend; admin checa `session.role === 'admin'` ou middleware.

### AI Agent

| Endpoint | Função |
|----------|--------|
| `POST /v1/chat/stream` | Chat streaming |
| `POST /v1/chat` | Chat síncrono |
| `POST /v1/kb/sync` | Sync VFS (agent secret ou JWT) |
| `GET /health` | Health + kb status |

---

## 7. Modelo de dados (Prisma)

Arquivo: `backend/prisma/schema.prisma`

| Model | Uso |
|-------|-----|
| `User` | auth, role enum `admin\|advogado\|gerencia` |
| `UserConsent` | LGPD |
| `WorkspaceSettings` | retenção, versão consentimento |
| `LlmProviderConfig` | BYOK criptografado |
| `AgentConversation` | `userId`, título, analysisType |
| `AgentMessage` | role, content JSON, usageJson |
| `AgentMessageAttachment` | storageKey, extractedText, uploadedByUserId |
| `KnowledgeBase` | base organizacional (1 ativa) |
| `KnowledgeDocument` | blob, extractedText, vfsSyncStatus |
| `IngestionJob` | fila ingestão |
| `AgentAuditLog` | telemetria agente |

Migração incremental: `backend/src/schema-sync.ts` (inclui migrate enum UserRole).

---

## 8. Segurança (implementado)

- JWT HS256 (`AUTH_SECRET`)
- BFF → backend: `X-Api-Secret` + Bearer
- Agente → backend internal: `AGENT_SERVICE_SECRET`
- BYOK: AES-256-GCM (`CREDENTIALS_ENCRYPTION_KEY`)
- Conversas/anexos: ownership por `userId`
- VFS export: só `request.auth.service`
- Rate limit ai-agent: `RATE_LIMIT_PER_MINUTE` (default 30)

---

## 9. O que foi removido / legado

- Módulos **help desk** (tickets, SLA, analytics Spiceworks, MCP analytics) — removidos na adaptação jurídica
- **Google/Gemini** — removido v2.2; extração só OpenAI
- Roles antigos: `lawyer`, `legal_assistant`, `readonly` — migrados, ainda aceitos em JWT via `normalizeRole`

---

## 10. Convenções para novas funcionalidades

1. **Backend primeiro:** rota Fastify + Prisma; depois BFF Next.js em `frontend/src/app/api/`
2. **Admin:** usar `requireAdmin()` no backend e `requireAdminSession()` / middleware no frontend
3. **Dados por usuário:** sempre filtrar por `resolveDbUserId(request.auth)` — ver `agent-conversations.ts`
4. **Agente:** novas tools em `ai-agent/app/tools.py`; prompts em `deep_prompts.py`
5. **Roles:** alterar `backend/src/core/roles.ts` + `frontend/src/lib/roles.ts` + schema Prisma + `schema-sync.ts`
6. **Deploy:** commit → push `production` e `develop`; Railway redeploy automático
7. **Não commitar:** `.env`, chaves BYOK
8. **Volume obrigatório:** `/data/storage` no backend (KB + anexos)

---

## 11. Ideias de evolução (não implementadas)

Use como backlog; validar escopo com o contratante antes de codar:

- ~~Permissões diferenciadas para **gerencia** (visão agregada, export)~~ ✓ v2.4
- ~~Edição/desativação de usuários na UI~~ ✓ v2.4
- ~~Relatórios de custo de tokens por usuário/período~~ ✓ v2.4
- Fluxo de **aprovações** gerenciais (ex.: revisão de minutas)
- Export CSV/PDF dos relatórios
- Multi-escritório / multi-tenant
- Integração DMS, e-mail, PJe
- Relatórios de custo de tokens por usuário/período
- Versionamento de documentos na KB
- Busca full-text na UI da KB
- Notificações quando documento KB fica `ready`
- SSO / LDAP
- API pública para parceiros

---

## 12. Comandos úteis

```bash
# Local
docker compose up -d --build

# Backend
cd backend && npx prisma generate && npm run build

# Frontend
cd frontend && npm run build

# AI Agent tests
cd ai-agent && pytest
```

---

## 13. Contato operacional

Fornecedor: **Zero Touch** · Fluxo: GitHub + Railway · Documentação deploy: `docs/DEPLOY-RAILWAY.md`
