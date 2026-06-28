# DNS público — zerotouch.tec.br (Cloudflare + Railway)

Guia para expor o **Legal AI Workspace** em domínio próprio, mantendo comunicação interna entre serviços via DNS Railway (`*.railway.internal` / referências `${{…}}`).

## URLs públicas do produto

| Ambiente | Branch Git | URL pública (app) |
|----------|------------|-------------------|
| **Produção** | `production` | `https://ia-dma.zerotouch.tec.br` |
| **Homologação** | `homolog` | `https://homolog-ia-dma.zerotouch.tec.br` |
| **Desenvolvimento** | `develop` | `https://dev-ia-dma.zerotouch.tec.br` |

O site institucional `https://www.zerotouch.tec.br/` é **independente** deste deploy (pode apenas linkar para `ia-dma`).

---

## 1. Railway — adicionar domínio customizado (frontend)

Repita em **cada ambiente** (production / homolog / development), no serviço **frontend**:

1. Railway → projeto **legal-ai-workspace** → ambiente correto → serviço **frontend**
2. **Settings** → **Networking** → **Custom Domain**
3. Adicionar:
   - Produção: `ia-dma.zerotouch.tec.br`
   - Homologação: `homolog-ia-dma.zerotouch.tec.br`
   - Development: `dev-ia-dma.zerotouch.tec.br`
4. Copiar o **destino CNAME** que o Railway exibir (ex.: `xxxx.up.railway.app`)

> **Backend** e **ai-agent** não precisam de domínio público próprio: o usuário acessa só o frontend; o BFF Next.js chama backend/agent via rede Railway.

---

## 2. Cloudflare — registros DNS

No zone **zerotouch.tec.br**:

| Nome | Tipo | Conteúdo | Proxy |
|------|------|----------|-------|
| `ia-dma` | `CNAME` | *(target do Railway — passo 1, produção)* | **DNS only** (cinza) — recomendado |
| `homolog-ia-dma` | `CNAME` | `qapmtdcp.up.railway.app` *(homolog — atualizar se Railway regenerar)* | **DNS only** (cinza) |
| `dev-ia-dma` | `CNAME` | *(target do Railway — passo 1, development)* | **DNS only** (cinza) — recomendado |

### Proxy Cloudflare (laranja) — cuidado

Com **Proxied** ativo, é comum ocorrer **loop infinito de redirect 301** (`location` apontando para a mesma URL). O app funciona no domínio `*.up.railway.app`, mas trava atrás do Cloudflare.

**Correção recomendada (Railway + Cloudflare):**

1. Cloudflare → DNS → editar `ia-dma` e `dev-ia-dma`
2. Clicar na nuvem **laranja** até ficar **cinza** (**DNS only**)
3. Aguardar 2–5 min e testar `https://ia-dma.zerotouch.tec.br/api/health`

O Railway emite o certificado TLS do domínio customizado — não precisa do proxy Cloudflare para HTTPS.

**Se precisar manter proxy laranja** (WAF/CDN Cloudflare):

| Cloudflare | Valor |
|------------|-------|
| SSL/TLS | **Full (strict)** — nunca *Flexible* |
| Edge Certificates → Always Use HTTPS | pode conflitar; teste desligado |
| Origin | certificado Railway ativo (Networking → Custom Domain → Active) |

**Sintoma do loop:** `curl -I https://ia-dma.zerotouch.tec.br/` retorna `301` com `location: https://ia-dma.zerotouch.tec.br/` repetidamente. Direto no Railway (`--resolve` para IP do `*.up.railway.app`) retorna `307` → `/dashboard/executive` (OK).

**www:** se `www.zerotouch.tec.br` for site institucional, configure à parte (página estática, redirect, etc.). Não é obrigatório para o Legal AI.

---

Checklist detalhado: **[RAILWAY-FRONTEND-URL.md](./RAILWAY-FRONTEND-URL.md)**

## 3. Variáveis Railway — o que **alterar**

Substituir apenas URLs **públicas do frontend** (`FRONTEND_URL`). Demais refs `${{…}}` internas Railway **permanecem**.

### Produção

| Serviço | Variável | Novo valor |
|---------|----------|------------|
| **backend** | `FRONTEND_URL` | `https://ia-dma.zerotouch.tec.br` |
| **ai-agent** | `FRONTEND_URL` | `https://ia-dma.zerotouch.tec.br` |
| **frontend** | *(nenhuma URL obrigatória)* | Domínio anexado no passo 1 |

### Desenvolvimento

| Serviço | Variável | Novo valor |
|---------|----------|------------|
| **backend** | `FRONTEND_URL` | `https://dev-ia-dma.zerotouch.tec.br` |
| **ai-agent** | `FRONTEND_URL` | `https://dev-ia-dma.zerotouch.tec.br` |

### Opcional — origens extras (CORS)

Se precisar aceitar outro host (ex. redirect temporário):

| Serviço | Variável | Exemplo |
|---------|----------|---------|
| backend | `ALLOWED_ORIGINS` | `https://www.zerotouch.tec.br` |
| ai-agent | `ALLOWED_ORIGINS` | `https://www.zerotouch.tec.br` |

---

## 4. Variáveis Railway — **não alterar** (DNS interno / refs Railway)

| Serviço | Variável | Manter |
|---------|----------|--------|
| backend | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| backend | `AI_AGENT_URL` | `https://${{ai-agent.RAILWAY_PUBLIC_DOMAIN}}` |
| frontend | `API_URL` | `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}` |
| frontend | `AI_AGENT_URL` | `https://${{ai-agent.RAILWAY_PUBLIC_DOMAIN}}` |
| ai-agent | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| ai-agent | `BACKEND_INTERNAL_URL` | `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}` ou ref privada Railway |

> Comunicação **server-side** (BFF → backend, agent → backend) continua pelos hostnames Railway. Apenas o browser do usuário usa `ia-dma.zerotouch.tec.br`.

---

## 5. Referência — domínios Railway atuais (fallback)

Use só até o DNS customizado propagar:

| Ambiente | Serviço | Host Railway (referência) |
|----------|---------|---------------------------|
| Produção | frontend | `frontend-production-4f7b.up.railway.app` |
| Produção | backend | `backend-production-b004.up.railway.app` |
| Produção | ai-agent | `ai-agent-production-d6f0.up.railway.app` |
| Development | frontend | *(ver **Networking** no painel Railway)* |
| Development | backend | *(idem)* |
| Development | ai-agent | *(idem)* |

---

## 6. Validação pós-DNS

```bash
# Deve retornar HTTP 200 (não 301 em loop)
curl -sI https://ia-dma.zerotouch.tec.br/api/health

# Raiz redireciona para login ou dashboard (307/302 — OK)
curl -sI https://ia-dma.zerotouch.tec.br/
```

1. `https://ia-dma.zerotouch.tec.br/api/health` → `200`
2. Login → cookie `law_session` (HTTPS)
3. Chat agente → streaming OK
4. Development: repetir em `dev-ia-dma.zerotouch.tec.br`

### Troubleshooting rápido

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Loop / “too many redirects” | Proxy CF laranja + SSL Flexible | DNS only (cinza) ou Full (strict) |
| 525 SSL handshake failed | Full strict sem cert Railway | Aguardar cert Active no Railway ou usar DNS only |
| 502 Bad Gateway | Porta errada no custom domain | Porta **8080** (detectada pelo Railway) |
| App OK em `*.railway.app` | DNS/CF apenas | Ajustar CNAME ou desligar proxy |

---

## 7. Rollback

- Remover custom domain no Railway (frontend)
- Reverter `FRONTEND_URL` para `https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}`
- Remover CNAMEs no Cloudflare

Tag de referência: **`v2.7.1`**
