# totvs-assistente-ti-agent

Assistente de TI platform-native para o TOTVS AI Agent Lab.

## Escopo

- Saúde do cluster (K8s, Argo CD)
- Métricas (Prometheus, Langfuse, MLflow)
- Documentação da plataforma (RAG + Knowledge Registry)
- Recomendações operacionais via `platform-ops-mcp`

**Fora do escopo:** chamados, SLA, ITIL/Spiceworks.

## Arquitetura

| Componente | Função |
|------------|--------|
| frontend | Chat UI (`ti.ai-lab.zerotouch.tec.br`) |
| backend | Auth, conversas, governance, KB upload |
| ai-agent | Deep Agent + intent router + MCP client |

Integrações platform-lab:

- `prompt-registry` — prompts versionados
- `knowledge-registry` — Qdrant `platform-docs`
- `platform-ops-mcp` — tools operacionais
- `llm-gateway` — LLM centralizado (gateway-only)

## CD

Push em `develop` → imagens `v0.1.0-totvs.N-dev` → GitOps `agents/assistente-ti/values.yaml`.

Secret cross-repo: `PLATFORM_LAB_PAT` (mesmo padrão do jurídico).

## Desenvolvimento local

Ver estrutura herdada do `totvs-juridico-agent` (bundle 3 containers).

```bash
cd ai-agent && pip install -r requirements.txt && pytest
```

## DNS

`https://ti.ai-lab.zerotouch.tec.br`
