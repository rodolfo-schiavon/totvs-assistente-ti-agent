# Status — Legal AI Workspace

Atualizado: **2026-06-11**

## Concluído

### Infra e deploy
- [x] Monorepo GitHub + Railway (backend, frontend, ai-agent, Postgres)
- [x] Branches `production` + `develop`
- [x] Volume `/data/storage` no backend
- [x] CI GitHub Actions + E2E Playwright

### Produto jurídico
- [x] Sidebar jurídica + dashboard executivo (KPIs conversas/docs)
- [x] Agente LangGraph documental + VFS RAG 3.0
- [x] 13 tipos de análise jurídica (`deep_prompts.py`)
- [x] Chat streaming, histórico, anexos na conversa
- [x] Base de conhecimento (upload, ingestão, sync VFS)
- [x] BYOK: OpenAI (extração) + Anthropic (chat) — Admin → LLM
- [x] Consentimento LGPD (`/consent`)
- [x] Extração PDF OpenAI com OCR e detecção de recusas
- [x] UI chat full-bleed, logout, tabelas markdown preservadas

### Segurança e perfis (v2.3 — commit `d368e3b`)
- [x] Perfis: `admin`, `advogado`, `gerencia` (migração automática roles legados)
- [x] Isolamento de conversas e anexos por usuário
- [x] Admin-only: BYOK, KB, usuários (backend + middleware + sidebar)
- [x] Validação ownership no BFF chat e no ai-agent
- [x] VFS export restrito ao serviço interno
- [x] Bloqueio `/api/admin/*` no middleware frontend

## Pendente (manual / produto)

- [ ] Rotacionar secrets de bootstrap se ainda em uso de testes
- [ ] Configurar OpenAI + Anthropic na tela Admin → LLM (produção)
- [ ] Habilitar **Wait for CI** nos serviços Railway
- [x] Perfis: `admin`, `advogado`, `gerencia` + relatórios gerenciais (v2.4)
- [x] UI completa de usuários (editar, desativar, excluir)
- [x] Relatórios de tokens/custo por usuário e conversa

## Credenciais bootstrap

Variáveis `ADMIN_USERNAME` / `ADMIN_PASSWORD` no serviço **backend** (Railway). Alterar após primeiro login.

## Documentação

- Estado completo para handoff: [`PRODUCT-HANDOFF.md`](./PRODUCT-HANDOFF.md)
- Agente: [`AGENT.md`](./AGENT.md)
- Deploy: [`DEPLOY-RAILWAY.md`](./DEPLOY-RAILWAY.md)
