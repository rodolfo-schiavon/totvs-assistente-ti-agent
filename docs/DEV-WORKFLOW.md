# Fluxo de desenvolvimento — Legal AI Workspace

## Ambientes

| Branch | Railway | URL |
|--------|---------|-----|
| `develop` | development | https://dev-ia-dma.zerotouch.tec.br |
| `homolog` | homolog | https://homolog-ia-dma.zerotouch.tec.br |
| `production` | production | https://ia-dma.zerotouch.tec.br |

## Regra obrigatória (Zero Touch)

1. **Todo código novo vai primeiro para `develop`** → deploy automático em **development**.
2. Validar no ambiente dev antes de qualquer promoção.
3. Merge **`develop` → `homolog`** → validar em homologação (UAT, cópia de produção).
4. **Produção somente com aprovação explícita** do responsável pelo projeto.
5. Após aprovação: `git checkout production && git merge homolog && git push origin production`.

## Ciclo diário

```bash
git checkout develop
# … implementar …
git add … && git commit -m "feat: …"
git push origin develop
# testar em https://dev-ia-dma.zerotouch.tec.br
```

## Promoção para homologação

```bash
git checkout homolog
git merge develop
git push origin homolog
# testar em https://homolog-ia-dma.zerotouch.tec.br
```

## Releases estáveis

Tags anotadas na branch `production` após validação:

```bash
git checkout production
git merge homolog   # somente após aprovação
git tag -a vX.Y.Z -m "Release estável produção"
git push origin production vX.Y.Z
```

**Baseline atual:** `v2.7.5`

## Checklist antes de pedir deploy em produção

- [ ] Testado em dev
- [ ] Testado em homolog
- [ ] CI verde (GitHub Actions)
- [ ] CHANGELOG atualizado (se release relevante)
- [ ] Sem secrets em commits
