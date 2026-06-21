# Architectural Tests

Invariantes estruturais executáveis que protegem as ADRs.

## O que cobrem

- **ADR-0003 (Business Layer):** UI não consulta tabelas de domínio diretamente; rotas não importam `*.server.ts`; serviços vivem em `src/lib/business/services/`.
- **ADR-0006 (Idempotency) / ADR-0007 (Observability):** `SUPABASE_SERVICE_ROLE_KEY` nunca aparece em código client-side.
- **ADR-0008 (RBAC):** funções `SECURITY DEFINER` em migrations declaram `SET search_path` fixo.
- **ADR-0009 (RLS):** toda `CREATE TABLE` em `public` numa migration tem `GRANT` e `ENABLE ROW LEVEL SECURITY` na mesma migration.

## Como rodar

```bash
bunx vitest run tests/architecture
```

Estes testes **não** medem performance — perf é coberta por k6 + SLOs em `docs/PERFORMANCE_BASELINE.md`.

## Política

- Falha de teste arquitetural **bloqueia merge**.
- Mudar a regra exige novo ADR + atualização aqui + atualização do `Architecture Freeze`.
- Quando aparecer um caso legítimo que não passa, **incrementar a regra**, não silenciar o teste.
