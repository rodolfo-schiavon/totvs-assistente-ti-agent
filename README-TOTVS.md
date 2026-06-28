# TOTVS Jurídico Agent

Agente jurídico derivado do [`legal-ai-workspace`](https://github.com/rodolfo-schiavon/legal-ai-workspace) (tag `v2.7.5`).

Este repositório é a **fonte de deploy** para a infra TOTVS (`totvs-ai-agent-platform-lab`).
O repositório original permanece intacto como produto de referência.

## Imagens (GHCR)

| Componente | Imagem |
|------------|--------|
| frontend | `ghcr.io/rodolfo-schiavon/totvs-juridico-frontend` |
| backend | `ghcr.io/rodolfo-schiavon/totvs-juridico-backend` |
| ai-agent | `ghcr.io/rodolfo-schiavon/totvs-juridico-ai-agent` |

Publicar: **Actions → Publish GHCR → Run workflow** (branch `main`).

## Sincronizar com upstream (opcional)

```bash
git remote add upstream https://github.com/rodolfo-schiavon/legal-ai-workspace.git
git fetch upstream --tags
# revisar diff antes de merge
git merge upstream/production
```

## Lab TOTVS

GitOps: `totvs-ai-agent-platform-lab/agents/juridico/`
Ingress: `juridico.ai-lab.zerotouch.tec.br`
