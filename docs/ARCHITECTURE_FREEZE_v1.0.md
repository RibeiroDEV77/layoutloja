# Architecture Freeze v1.0

> **Status:** OFICIAL — congelado em 2026-06-21.
> **Aprovado para:** todas as fases até 5.3 inclusive (Order Engine v1.1).
> **Regra de mudança:** nenhuma alteração estrutural pode ser feita sem incremento formal de versão e atualização deste documento + ADR correspondente.

---

## 1. Princípios fundadores

1. **Business Layer é a única fonte de verdade de domínio.** Telas são consumidoras de Server Functions. Nenhum acesso direto ao banco a partir de componentes.
2. **Imutabilidade forense.** Snapshots, Timelines append-only e Ledger garantem reprodutibilidade do passado.
3. **Idempotência obrigatória** em toda operação não-trivial (chave de escopo + corpo determinístico).
4. **Eventual consistency via Outbox** para integrações; nunca side-effects síncronos em handlers de UI.
5. **Workflow Engine** governa estados; nenhum service muda status sem transição registrada.
6. **Multi-tenant nativo:** toda tabela de negócio tem `store_id` + RLS por permissão.
7. **RBAC + RLS sempre juntos.** Permissões via `has_permission(uid, code, store)`; RLS via security-definer.
8. **Auditabilidade total:** Audit Log técnico + Timeline funcional + Ledger financeiro coexistem.
9. **Extensibilidade por adapters,** não por código no agregado: Pricing, Shipping, Payments, Tax, Notifications.
10. **Observabilidade nativa:** métricas, traces, health checks e feature flags em toda operação relevante.

---

## 2. Camadas da plataforma

```
┌─────────────────────────────────────────────────────────────┐
│ UI (TanStack Routes / React)                                │
│ - apenas consome Server Functions                           │
│ - zero queries diretas a tabelas de domínio                 │
└─────────────────────────────────────────────────────────────┘
                            │ useServerFn / loaders
┌─────────────────────────────────────────────────────────────┐
│ Server Functions (createServerFn)                           │
│ - requireSupabaseAuth + idempotency + RBAC check            │
│ - validação de input (Zod)                                  │
│ - delega para Business Services                             │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│ Business Layer (services/*.server.ts)                       │
│ - regras de domínio puras                                   │
│ - usa Repositories + Workflow + Outbox + Metrics            │
│ - transações controladas via with-business                  │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│ Repositories + RPCs SQL (security definer)                  │
│ - acesso ao Postgres                                        │
│ - triggers, validators, audit                               │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│ Postgres (Supabase)                                         │
│ - RLS por permissão + store_id                              │
│ - Outbox / Idempotency / Metrics / Audit / Workflow         │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│ Outbox Workers + Adapters externos                          │
│ - payment gateways, carriers, fiscal, notifications         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Fundações implementadas

| Fundação | Estado | Tabelas-chave / Funções |
|---|---|---|
| **F1 — Bootstrap & Convenções** | Congelado | `set_updated_at`, `audit_row_change`, padrão de migration |
| **F2 — Auth / RBAC / RLS / Stores** | Congelado | `roles`, `permissions`, `user_roles`, `role_permissions`, `stores`, `has_role`, `has_permission`, `is_super_admin`, `user_store_ids`, `current_user_context`, `claim_first_super_admin` |
| **F3 — Catálogo** | Congelado | `products`, `product_variants`, `product_colors`, `product_color_media`, `categories`, `brands`, `collections`, `attributes`, `attribute_values`, `tags` |
| **F4 — Inventário & Compras** | Congelado | `warehouses`, `stock_levels`, `stock_movements`, `suppliers`, `purchase_orders`, `goods_receipts`, `inventory_counts`, `stock_transfers`, `cost_history` |
| **F5.1 — Customer Hub** | Congelado | `customers`, `customer_addresses`, `customer_contacts`, `customer_groups`, `customer_groups_map`, `customer_tags`, `customer_notes`, `customer_credit_ledger`, `customer_consents_log`, `customer_score_factors`, `recompute_customer_score` |
| **F5.2 — Cart / Pricing / Coupons / Shipping** | Congelado | `carts`, `cart_items`, `cart_snapshots`, `cart_timeline`, `cart_coupons`, `stock_reservations`, `stock_reservation_ledger`, `coupons`, `coupon_ledger`, `coupon_redemptions`, `shipping_zones`, `shipping_zone_postal_ranges`, `shipping_methods`, `shipping_rates`, `shipping_quotes`, `shipping_snapshots`. RPCs: `cart_recalculate`, `cart_apply_pricing`, `reserve_stock_for_cart_item`, `release_stock_reservation`, `expire_stale_cart_reservations`, `apply_coupon_to_cart`, `remove_coupon_from_cart`, `validate_coupon`, `merge_anonymous_cart`, `record_cart_timeline_event` |
| **Plataforma — Workflow Engine** | Congelado | `workflow_definitions`, `workflow_instances`, `workflow_states`, `workflow_transitions`, `workflow_state_history` |
| **Plataforma — Outbox** | Congelado | `event_outbox`, `event_outbox_dead_letter`, `domain_events`, `domain_event_subscriptions`, `event_delivery_log`, RPCs `enqueue_outbox_event`, `claim_outbox_batch`, `mark_outbox_published`, `mark_outbox_failed`, `release_stale_outbox_locks` |
| **Plataforma — Idempotency** | Congelado | `idempotency_keys`, `idempotency_begin`, `idempotency_complete`, `purge_expired_idempotency_keys` |
| **Plataforma — Observability** | Congelado | `metrics`, `traces`, `health_checks`, `system_logs`, `record_metric`, `record_health_check` |
| **Plataforma — Feature Flags** | Congelado | `feature_flags`, `feature_flag_overrides`, `evaluate_feature_flag` |
| **Plataforma — Audit Log** | Congelado | `audit_log`, trigger `audit_row_change` |
| **DAM** | Congelado | `assets`, `asset_versions`, `asset_links`, `asset_tags`, `asset_tag_map`, `asset_folders`, `asset_upload_jobs` |

---

## 4. Fase aprovada para implementação imediata

### F5.3 — Order Engine (OMS) — v1.1 com refinamentos
Documentos de referência:
- `Fase_5_3_Order_Engine_Arquitetura.md` (v1.0)
- `Fase_5_3_Delta_Refinamentos.md` (delta v1.1)

10 engines/módulos: Order Aggregate · Snapshots · Timeline · Ledger · Workflow · Hold Engine · Split Order · Payment Allocation · Lock Manager · Order Documents (DAM) · Order Score · Order Rule Engine · Search Index expandido · Métricas Horárias.

---

## 5. Roadmap pós-5.3 (não congelado — sujeito a aprovação)

| Fase | Escopo |
|---|---|
| 5.4 | Fiscal (NF-e via adapter), tax engine |
| 5.5 | Notification worker (email/SMS/WhatsApp) |
| 5.6 | Storefront público (cart UI cliente, checkout UI) |
| 6.0 | Marketplace / multi-seller / split payout |
| 6.1 | Subscriptions / recorrência |
| 6.2 | B2B / cotações / aprovações multi-nível |

---

## 6. Política de versionamento da arquitetura

1. **Patch (v1.0.x):** correções textuais, esclarecimentos, sem mudança estrutural.
2. **Minor (v1.x.0):** novas tabelas/services/eventos que **não quebram** contratos existentes. Requer ADR.
3. **Major (vX.0.0):** mudança que altera contratos públicos, RLS, ou semântica de evento/ledger. Requer ADR + plano de migração + aprovação explícita.

Toda mudança estrutural deve:
1. Atualizar este documento (seção 3 ou 4).
2. Criar/atualizar ADR em `docs/adr/`.
3. Atualizar `PERFORMANCE_BASELINE.md` se relevante.
4. Os testes em `tests/architecture/` devem continuar passando.

---

## 7. Documentos relacionados

- [`docs/adr/README.md`](./adr/README.md) — índice das ADRs.
- [`docs/PERFORMANCE_BASELINE.md`](./PERFORMANCE_BASELINE.md) — baseline e SLOs.
- [`tests/architecture/`](../tests/architecture/) — invariantes estruturais executáveis.
