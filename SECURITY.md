# Segurança — Legal AI Workspace

## Secrets

Nunca commite `.env`, chaves BYOK ou credenciais bootstrap. Rotacione imediatamente se expostos:

- `AUTH_SECRET` / JWT
- `API_SECRET`
- `AGENT_SERVICE_SECRET`
- `CREDENTIALS_ENCRYPTION_KEY`
- `OPENAI_API_KEY` *(opcional — bootstrap; preferir tela LLM)*
- `ADMIN_PASSWORD`

## Dados jurídicos

- Uso interno single-tenant por deploy
- Consentimento obrigatório (`/consent`) antes do uso
- Auditoria de ações (sem armazenar conteúdo integral de documentos em logs)
- BYOK: dados enviados ao provedor LLM configurado pelo escritório

## Reporte

Contate o administrador Zero Touch para incidentes de segurança.
