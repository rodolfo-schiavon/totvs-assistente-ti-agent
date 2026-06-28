# FRONTEND_URL — checklist Railway (verificado 2026-06-12)

`FRONTEND_URL` controla **CORS** no backend e no ai-agent (origem permitida do browser).

## Valores corretos

| Ambiente | `FRONTEND_URL` |
|----------|----------------|
| **production** | `https://ia-dma.zerotouch.tec.br` |
| **development** | `https://dev-ia-dma.zerotouch.tec.br` |

## Onde definir (somente estes 2 serviços × 2 ambientes)

| Ambiente | Serviço | `FRONTEND_URL` | Status |
|----------|---------|----------------|--------|
| production | **backend** | `https://ia-dma.zerotouch.tec.br` | OK |
| production | **ai-agent** | `https://ia-dma.zerotouch.tec.br` | OK |
| development | **backend** | `https://dev-ia-dma.zerotouch.tec.br` | OK |
| development | **ai-agent** | `https://dev-ia-dma.zerotouch.tec.br` | **Definir** (faltava) |

O serviço **frontend** não usa `FRONTEND_URL`.

## Comando CLI (development / ai-agent)

```bash
cd legal-ai-workspace
railway link -p c83d9139-3b1b-4f35-93e5-8349862cae9f -e development -s ai-agent
railway variable set FRONTEND_URL=https://dev-ia-dma.zerotouch.tec.br
```

Ou no painel Railway: **development** → **ai-agent** → **Variables** → adicionar `FRONTEND_URL`.

## Validar CORS após deploy

```bash
# Produção — deve retornar access-control-allow-origin: https://ia-dma.zerotouch.tec.br
curl -sI -H "Origin: https://ia-dma.zerotouch.tec.br" \
  https://backend-production-b004.up.railway.app/api/v1/health | grep -i access-control

# Development
curl -sI -H "Origin: https://dev-ia-dma.zerotouch.tec.br" \
  https://backend-development-190b.up.railway.app/api/v1/health | grep -i access-control
```

## Não alterar

- `DATABASE_URL` → `postgres.railway.internal`
- `API_URL` / `BACKEND_INTERNAL_URL` → refs `*.up.railway.app` ou internas
- `RAILWAY_SERVICE_*` → geradas pelo Railway

## Opcional — `ALLOWED_ORIGINS`

Só se precisar aceitar outra origem (ex. `https://www.zerotouch.tec.br`):

```
ALLOWED_ORIGINS=https://www.zerotouch.tec.br
```

(backend + ai-agent, mesmo ambiente)
