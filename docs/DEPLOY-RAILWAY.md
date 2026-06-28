# Deploy Railway — Legal AI Workspace (Zero Touch)

## Projeto Railway

- Projeto: **legal-ai-workspace** (`c83d9139-3b1b-4f35-93e5-8349862cae9f`)
- Ambientes: `development` (branch `develop`) · `homolog` (branch `homolog`) · `production` (branch `production`)

### Root Directory (obrigatório no monorepo)

Em cada serviço GitHub → **Settings** → **Root Directory**:

| Serviço | Root |
|---------|------|
| backend | `backend` |
| frontend | `frontend` |
| ai-agent | `ai-agent` |

### Domínio público (produção / desenvolvimento)

| Ambiente | URL do app |
|----------|------------|
| Produção | `https://ia-dma.zerotouch.tec.br` |
| Homologação | `https://homolog-ia-dma.zerotouch.tec.br` |
| Desenvolvimento | `https://dev-ia-dma.zerotouch.tec.br` |

Passo a passo DNS (Cloudflare + Railway): **[DNS-CLOUDFLARE.md](./DNS-CLOUDFLARE.md)**

### Variáveis com referência Railway (recomendado)

| Serviço | Variável | Valor |
|---------|----------|-------|
| backend | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| backend | `FRONTEND_URL` | `https://ia-dma.zerotouch.tec.br` *(prod)* · `https://homolog-ia-dma.zerotouch.tec.br` *(homolog)* · `https://dev-ia-dma.zerotouch.tec.br` *(dev)* |
| backend | `AI_AGENT_URL` | `https://${{ai-agent.RAILWAY_PUBLIC_DOMAIN}}` |
| frontend | `API_URL` | `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}` |
| frontend | `AI_AGENT_URL` | `https://${{ai-agent.RAILWAY_PUBLIC_DOMAIN}}` |
| ai-agent | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| ai-agent | `BACKEND_INTERNAL_URL` | `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}` |
| ai-agent | `FRONTEND_URL` | `https://ia-dma.zerotouch.tec.br` *(prod)* · `https://homolog-ia-dma.zerotouch.tec.br` *(homolog)* · `https://dev-ia-dma.zerotouch.tec.br` *(dev)* |

**Nota:** `${{backend.PORT}}` em URLs internas nem sempre resolve entre serviços — use domínios públicos Railway acima para `API_URL` / `BACKEND_INTERNAL_URL`. **Não** substitua refs `${{Postgres…}}` / DNS interno Railway.

**Fallback** (antes do DNS customizado): `FRONTEND_URL` = `https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}`

**Development:** `RUN_PRISMA_DB_PUSH=true` + `PRISMA_ACCEPT_DATA_LOSS=true` somente no primeiro deploy (Postgres vazio). Depois remova ou deixe unset.

**Production:** não defina `RUN_PRISMA_DB_PUSH` (schema Prisma já existe; evita conflito com tabelas LangGraph).

## Repositório GitHub

- Repositório: https://github.com/rodolfo-schiavon/legal-ai-workspace
- **production** → ambiente Railway **production**
- **homolog** → ambiente Railway **homolog** (cópia de produção para UAT)
- **develop** → ambiente Railway **development**

### Fluxo de atualização (obrigatório)

> **Regra Zero Touch:** todo desenvolvimento vai primeiro para **`develop`** → Railway **development**.  
> Promoção para **`homolog`** após validação em dev.  
> Deploy em **produção** (`production`) **somente após aprovação explícita** do responsável pelo projeto.

1. Implementar e commitar na branch **`develop`**
2. `git push origin develop` → validar em `https://dev-ia-dma.zerotouch.tec.br`
3. GitHub Actions (`.github/workflows/ci.yml`) — build + E2E
4. Merge `develop` → `homolog` e `git push origin homolog` → validar em `https://homolog-ia-dma.zerotouch.tec.br`
5. Após aprovação: merge `homolog` → `production` e `git push origin production`
6. Railway redeploya o ambiente correspondente (**Wait for CI** recomendado)

### Tags de release estável

```bash
git checkout production
git tag -a vX.Y.Z -m "Release estável produção"
git push origin vX.Y.Z
```

Baseline atual em produção: **`v2.7.5`**

## Serviços Railway (por ambiente)

| Serviço | Root directory | Porta | Health |
|---------|----------------|-------|--------|
| PostgreSQL | (plugin) | 5432 | — |
| backend | `backend` | 8000 | `/api/v1/health` |
| frontend | `frontend` | 3000 | `/api/health` |
| ai-agent | `ai-agent` | 8100 | `/health` |
| Volume | backend mount `/data/storage` | — | — |

## Variáveis críticas

### Backend

| Variável | Notas |
|----------|-------|
| `DATABASE_URL` | Plugin PostgreSQL |
| `STORAGE_PATH` | `/data/storage` + Volume Railway |
| `CREDENTIALS_ENCRYPTION_KEY` | Criptografia BYOK (mín. 32 chars) |
| `OPENAI_API_KEY` | *(opcional)* bootstrap extração se ainda não configurou OpenAI na GUI |
| `API_SECRET` / `AUTH_SECRET` / `AGENT_SERVICE_SECRET` | Mesmos valores no frontend/ai-agent |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Bootstrap admin |
| `FRONTEND_URL` | URL pública do frontend |

### Frontend

| Variável | Notas |
|----------|-------|
| `API_URL` | URL pública do backend |
| `AI_AGENT_URL` | URL do ai-agent (BFF) |
| `NEXT_PUBLIC_APP_NAME` | `Legal AI Workspace` |

### ai-agent

| Variável | Notas |
|----------|-------|
| `DATABASE_URL` | Mesmo Postgres |
| `BACKEND_INTERNAL_URL` | URL interna Railway do backend |
| `KB_VFS_PATH` | `/legal-kb/` (default) |

## LLM

- **Chat jurídico:** configure **Anthropic** via **Admin → LLM** (painel Anthropic)
- **Extração PDF/OCR:** configure **OpenAI** via **Admin → LLM** (painel OpenAI)
- Uma chave por provedor (`openai` + `anthropic`). Remova `GEMINI_API_KEY` / `GOOGLE_API_KEY` se existirem.

## Base de conhecimento

1. Upload em **Base de conhecimento** (PDF, DOCX, TXT, ODT)
2. PDF → OpenAI; demais → extrator local
3. Status `ready` → sync VFS `/legal-kb/`
