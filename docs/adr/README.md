# Architecture Decision Records (ADR)

Registro formal das decisões arquiteturais da plataforma. Cada ADR captura **contexto, decisão, alternativas e consequências**.

## Convenções

- Numeração sequencial (`0001-...`, `0002-...`).
- Status: `Proposto`, `Aceito`, `Substituído por ADR-XXXX`, `Deprecado`.
- Mudanças estruturais exigem novo ADR (não editar ADR aceito — superseda).

## Índice

| # | Título | Status |
|---|---|---|
| [0001](./0001-workflow-engine.md) | Workflow Engine como governante de estados | Aceito |
| [0002](./0002-transactional-outbox.md) | Transactional Outbox para eventos de domínio | Aceito |
| [0003](./0003-business-layer.md) | Business Layer como única fonte de domínio | Aceito |
| [0004](./0004-dam.md) | Digital Asset Management centralizado | Aceito |
| [0005](./0005-oms-order-engine.md) | OMS-first Order Engine (não CRUD) | Aceito |
| [0006](./0006-idempotency.md) | Idempotency Keys obrigatórias em mutações críticas | Aceito |
| [0007](./0007-observability.md) | Observability nativa: métricas, traces, health, flags | Aceito |
| [0008](./0008-rbac.md) | RBAC via `has_permission` security-definer | Aceito |
| [0009](./0009-rls.md) | RLS por permissão + `store_id` (multi-tenant) | Aceito |
