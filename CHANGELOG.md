# Changelog

## [Unreleased]

## [2.7.5] — 2026-06-18

### Corrigido
- **Contratos e minutas longas:** `maxTokens` padrão elevado de 4096 para **16384**; migração automática de configs Anthropic legadas no startup; continuação automática quando a resposta é cortada por limite de tokens ou termina no meio de uma cláusula; anexos com até 50k caracteres no contexto do agente.
- **Chat com anexo / criação de contrato:** evita streaming de raciocínio interno do agente (loops “Deixe-me criar…”); usa caminho síncrono com timeout para anexos e minutas; limite de recursão menor; UI libera botão enviar se o stream encerrar sem `done`.

## [2.7.4] — 2026-06-18

### Adicionado
- Ambiente de **homologação**: branch Git `homolog`, Railway `homolog`, URL `https://homolog-ia-dma.zerotouch.tec.br` (cópia de produção para UAT).

### Corrigido
- **Chat / BYOK Anthropic:** modelos aposentados (`claude-3-5-haiku-20241022`, `claude-sonnet-4-20250514`, etc.) migrados automaticamente no startup do backend para IDs ativos.
- Catálogo LLM atualizado (Claude Sonnet 4.5/4.6, Haiku 4.5).
- Teste de conexão BYOK falha corretamente quando o modelo retorna 404.
- Mensagens de erro do chat mais claras quando o modelo não existe na Anthropic.

## [2.7.3] — 2026-06-12

### Corrigido
- **Base de conhecimento:** acesso para **admin** e **gerência** (rotas, middleware, sidebar); mensagem de erro quando a listagem falha.
- **Chat — anexos PDF com imagens:** extração **assíncrona** com polling (evita timeout HTTP ~120s no OCR).
- **Development:** migração incremental da coluna `embedding` em `ConversationMessageEmbedding` (backend dev não subia).

### Fluxo de deploy (a partir desta release)
- Trabalho padrão na branch **`develop`** → Railway **development** (`dev-ia-dma.zerotouch.tec.br`).
- **Produção** (`production` / `ia-dma.zerotouch.tec.br`) somente com **aprovação explícita** do responsável.

### Rollback
- `git checkout v2.7.2` (auth/identidade) · `git checkout v2.7.1` (DNS/UX CIC)

## [2.7.2] — 2026-06-12

### Adicionado — Segurança e identidade
- Senha **temporária** automática na criação de usuários (troca obrigatória no 1º login).
- Política de senha forte (12+ chars, complexidade) e expiração a cada **45 dias** (aviso 7 dias antes).
- Tela **Minha senha** (`/account/password`) e `/change-password` forçado.
- Consentimento de IA no login com checkbox “não exibir novamente”.

### Alterado
- Placeholder do agente jurídico e atalhos pós-resposta (sem textos helpdesk).
- Removido aviso legal repetido em cada mensagem do agente (aceite no login).

## [2.7.1] — 2026-06-09

### Adicionado
- **DNS público** `ia-dma.zerotouch.tec.br` (prod) e `dev-ia-dma.zerotouch.tec.br` (dev) — guia [`docs/DNS-CLOUDFLARE.md`](docs/DNS-CLOUDFLARE.md).
- CORS com `ALLOWED_ORIGINS` opcional (backend + ai-agent).

### Alterado
- UX auditoria: linha clicável na listagem, export `.txt` por conversa, sidebar plano.
- `DEPLOY-RAILWAY.md` e handoff atualizados para domínio Zero Touch.

## [2.7.0] — 2026-06-09

### Adicionado — Conversation Intelligence Center
- **8 tabelas CIC** + embeddings pgvector: métricas, auditoria, views, exports, riscos, compliance, busca.
- **Dashboard executivo** e listagem avançada (TanStack Table) em `/dashboard/admin/conversations/*`.
- **Busca híbrida** FTS + semântica (OpenAI embeddings).
- **Timeline** com auditoria por mensagem (join com `LlmObservability` / RAG).
- **Monitoramento de riscos** (PII, injection, financeiro, saúde).
- **LGPD:** anonimização, logs de visualização/exportação, compliance UI.
- **Captura de contexto** IP/User-Agent no BFF chat.
- Permissões granulares em `conversation-permissions.ts` (admin + gerencia).

### Rollback
- Baseline estável anterior: **`v2.6.0`** (`git checkout v2.6.0`)

## [2.6.0] — 2026-06-09

### Adicionado — IA Observability & AI Governance Center
- **10 tabelas** de governança: observabilidade LLM, analytics de prompts, segurança, qualidade, RAG, alucinação, custos, feedback, alertas e métricas executivas (+ `LgpdRequest`).
- **Ingestão assíncrona** via `POST /api/v1/internal/governance/ingest` (agent secret) — zero impacto no hot path do chat.
- **`guard_input` conectado** ao fluxo de chat (sync + stream) com emissão de `PromptSecurityEvent`.
- **Jobs de agregação** (5 min): rollups, materialized view `mv_governance_daily`, purge LGPD, cache overview 60s.
- **12 submenus** em `/dashboard/admin/governance/*` (admin + gerencia): Visão Geral, Qualidade, Observabilidade, Custos, Segurança, Compliance, Uso, Prompts, RAG, Modelos, Feedback, Alertas.
- **Exportação** CSV / JSON / XLSX / PDF por seção.
- **Feedback no chat:** 👍 👎 ⭐1–5 → `POST /api/v1/governance/feedback`.
- **Motor de alertas** configurável (custo, tokens, injection, erro, feedback, RAG, orçamento mensal).
- **Compliance/LGPD:** retenção, PII flag, solicitações LGPD CRUD.
- **Produtividade/ROI heurístico** em Analytics de Uso.

### Alterado
- `/dashboard/management/reports` redireciona para **Governança → Custos**.
- Audit do agente passa `userId` explicitamente.

### Rollback
- Baseline estável anterior: **`v2.5.0`** (`git checkout v2.5.0`).
- **Esta release (`v2.6.0`)** é o rollback point antes do Conversation Intelligence Center: `git checkout v2.6.0`

## [2.5.0] — 2026-06-11

> Tag de rollback estável antes do módulo de governança (`git checkout v2.5.0`).

### Adicionado
- **Busca full-text na KB** (admin): título + conteúdo extraído, com snippet e destaque do termo.
- **Busca no histórico de conversas**: título e mensagens (sidebar do agente), isolada por usuário.
- **Notificações KB ready**: toasts ao concluir ingestão, sync VFS e falhas (polling 8s).

### APIs
- `GET /api/v1/knowledge/documents/search?q=`
- `GET /api/v1/agent/conversations/search?q=`

## [2.4.0] — 2026-06-11

### Adicionado
- **Gerência:** relatórios consolidados em `/dashboard/management/reports` (tokens e custo por usuário/conversa).
- **Dashboard role-aware:** advogado vê métricas pessoais; gerencia/admin vê visão organizacional.
- **UI usuários:** editar perfil, ativar/desativar, redefinir senha e excluir (BFF PATCH/DELETE).
- API `GET /api/v1/management/reports/usage` + serviço `usage-reports.ts`.
- Helpers `canViewManagementReports`, `requireManagement()`.

### Segurança
- Dashboard legal exige autenticação JWT; advogado não vê estatísticas globais.

## [2.3.0] — 2026-06-11

### Adicionado
- Perfis **`admin`**, **`advogado`**, **`gerencia`** (substituem lawyer/legal_assistant/readonly).
- Migração automática do enum `UserRole` no startup (`schema-sync.ts`).
- Módulo central de roles (`backend/src/core/roles.ts`, `frontend/src/lib/roles.ts`).
- Endpoint BFF `GET /api/auth/me` para sessão na sidebar.
- Documentação de handoff: `docs/PRODUCT-HANDOFF.md`.

### Segurança
- Isolamento de conversas e anexos por `userId` (sem bypass por service auth).
- Validação de ownership no BFF chat e no ai-agent antes de usar `conversation_id`.
- Admin exige JWT real; VFS export restrito ao serviço interno.
- Middleware bloqueia `/api/admin/*`; sidebar oculta links admin para não-admins.

### Alterado
- UI usuários: três perfis + senha mín. 8.
- `docs/AGENT.md`, README, checklists go-live atualizados.

## [2.2.0] — 2026-06-09

### Alterado
- Extração de PDF/OCR/mídia migrada de **Gemini → OpenAI** (`openai-pdf.ts`).
- Chat e análises jurídicas exclusivamente via **Anthropic** (ai-agent).
- Tela Admin → LLM redesenhada: dois painéis fixos (OpenAI extração + Anthropic chat), **uma chave por provedor**.
- Chaves da GUI persistidas no Postgres e aplicadas em runtime (equivalente funcional a variáveis de ambiente).

### Removido
- Suporte Google/Gemini (`gemini.ts`, `langchain-google-genai`).

## [2.1.0] — 2026-05-30

Marco de referência validado em **development** (Railway): RAG 3.0 estável, PDF via Gemini, agente documental e gráficos executivos.

### Adicionado
- Extração de **PDF inteiro via Gemini** na ingestão da base de conhecimento (texto + OCR em imagens embutidas).
- Variáveis `GOOGLE_API_KEY` / `GEMINI_API_KEY`, `GEMINI_PDF_MODEL`, `GEMINI_PDF_MAX_OUTPUT_TOKENS`, `GEMINI_PDF_TIMEOUT_MS` no backend.
- Gráficos do agente com **cores por categoria**, valores nas barras, resumo ranqueado com % e donut para distribuições pequenas.
- Heal automático de documentos KB após redeploy (storage + re-sync VFS).

### Corrigido
- Limite de recursão LangGraph no modo documentos (`recursion_limit` configurável, mensagem amigável em PT).
- Síntese do agente sem relatório interno do researcher; fontes no rodapé `[Doc: …]`.
- Busca VFS com dicas PT→EN; re-sync de documentos truncados no VFS.
- Storage persistente `/data/storage` e recuperação de `extractedText` quando o blob falta.

### Notas de deploy (production)
- Backend: volume Railway em `/data/storage` obrigatório para KB/anexos.
- PDF na KB: chave Gemini no backend **ou** provedor Google/Gemini ativo no admin LLM.
- `AI_AGENT_URL` no backend deve apontar para o ai-agent **do mesmo ambiente**.

## [2.0.0] — 2026-05-29

RAG 3.0 Deep Agent (VFS + researcher); remoção pgvector; import Spiceworks, analytics e UI do agente.

## [1.1.0]

Segurança, LangSmith, checkpoints LangGraph, Railway development.

## [1.0.0]

Versão estável inicial — chat, RAG, base de conhecimento.
