# Secrets — GitHub Actions

## Obrigatório para CD automático

| Secret | Repo | Como criar |
|--------|------|------------|
| `PLATFORM_LAB_PAT` | `totvs-assistente-ti-agent` | [Classic PAT](https://github.com/settings/tokens) com escopo `repo` (write no `totvs-ai-agent-platform-lab`) |

```bash
gh secret set PLATFORM_LAB_PAT \
  --repo rodolfo-schiavon/totvs-assistente-ti-agent \
  --body "ghp_SEU_TOKEN"
```

Mesmo token usado no `totvs-juridico-agent`. Sem este secret, o job `dispatch-gitops` falha após o build.

Documentação: [docs/13-cd-pipeline.md](https://github.com/rodolfo-schiavon/totvs-ai-agent-platform-lab/blob/main/docs/13-cd-pipeline.md)
