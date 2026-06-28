# Checklist pré-produção — Legal AI Workspace

Execute antes de liberar uso interno no ambiente `production`.

## Segurança

- [ ] Rotacionar `AUTH_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`, `API_SECRET`, `AGENT_SERVICE_SECRET`
- [ ] `ADMIN_PASSWORD` forte; alterar após primeiro login
- [ ] BYOK: chaves Anthropic/OpenAI apenas via tela LLM (nunca no git)
- [ ] Validar que usuário não-admin não acessa `/dashboard/admin/*` nem `/api/admin/*`
- [ ] Validar que usuário A não vê conversas do usuário B

## Railway (production)

- [ ] Postgres plugin + volume `/data/storage` no backend
- [ ] 4 serviços: `backend`, `frontend`, `ai-agent`, postgres
- [ ] Root Directory correto por serviço (ver `DEPLOY-RAILWAY.md`)
- [ ] `AI_AGENT_URL` e `BACKEND_INTERNAL_URL` no mesmo ambiente
- [ ] Configurar **OpenAI** e **Anthropic** na tela Admin → LLM
- [ ] Health checks verdes
- [ ] Branch `production` com **Wait for CI** habilitado

## Funcional

- [ ] Login → consentimento → dashboard jurídico
- [ ] Chat com streaming e histórico (por usuário)
- [ ] Upload anexo na conversa + resposta usa conteúdo
- [ ] Upload PDF/DOCX/TXT na base de conhecimento + sync VFS (`synced`)
- [ ] BYOK Anthropic testado (chat) e OpenAI (extração PDF)
- [ ] Perfis: **admin**, **advogado**, **gerencia**
- [ ] Gerencia acessa `/dashboard/management/reports`; advogado é bloqueado
- [ ] Advogado vê dashboard pessoal (não estatísticas globais)
- [ ] Admin edita/desativa/exclui usuários na UI
- [ ] CI + E2E Playwright verdes no GitHub

## LGPD

- [ ] Termo de consentimento publicado (`/consent`)
- [ ] Retenção configurada em `WorkspaceSettings`
- [ ] Auditoria sem conteúdo sensível completo em logs

## Pós-go-live

- [ ] Monitorar erros Railway 24h
- [ ] Validar custos de tokens BYOK com equipe jurídica
