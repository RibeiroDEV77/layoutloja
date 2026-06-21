
# Fase 5 — Módulo Comercial (Arquitetura)

Documento técnico para revisão. Nada será implementado até aprovação.

---

## 1. Visão geral

O módulo Comercial cobre todo o ciclo de venda: cliente → carrinho → checkout → pedido → pagamento → expedição → fiscal → pós-venda. É multi-loja, multi-canal (varejo, atacado, e-commerce), suporta PF/PJ, integra-se com `customer_groups`, `price_lists`, DAM, estoque (warehouses/stock_levels) e o Workflow Engine genérico.

Princípios:
- **Business Layer obrigatória**: UI → server functions (`createServerFn`) → services → repositories → Supabase. Nenhuma tela acessa o banco diretamente.
- **RLS + RBAC** em todas as tabelas, escopadas por `store_id` via `has_permission()` / `is_super_admin()`.
- **Domain Events** persistidos em `domain_events` para toda transição relevante.
- **Workflow Engine genérico**, reutilizado por `orders`, `purchase_orders`, `inventory_counts`, `products`, `suppliers`.
- **Idempotência** em pagamentos, webhooks e criação de pedidos (chave `idempotency_key`).
- **Transações**: criação de pedido, baixa de estoque, geração de pagamento ocorrem em RPC `SECURITY DEFINER`.

---

## 2. Modelo de dados (tabelas)

### 2.1 Clientes
- **customers** — `id, store_id, type ('pf'|'pj'), code, status ('active'|'inactive'|'blocked'), email, phone, doc_type, doc_number (CPF/CNPJ), name, legal_name, trade_name, state_registration, municipal_registration, birth_date, gender, default_price_list_id, default_payment_terms, credit_limit, segment ('retail'|'wholesale'|'rep'|'distributor'|'reseller'|'vip'), origin, marketing_opt_in, notes, auth_user_id (FK → auth.users, NULL para guests), created_by, created_at, updated_at, deleted_at`. UNIQUE `(store_id, doc_number)` parcial.
- **customer_groups_map** — `customer_id, customer_group_id` (M:N com `customer_groups` já existente).
- **customer_contacts** (apenas PJ) — `id, customer_id, name, role, email, phone, is_primary`.
- **customer_tax_profiles** — `customer_id, regime ('mei'|'simples'|'presumido'|'real'|'isento'), icms_taxpayer (bool), suframa, ie_isento`.
- **customer_credit_ledger** — movimentos de crédito/devolução (`customer_id, kind, amount, reference_type, reference_id, balance_after`).

### 2.2 Endereços
- **customer_addresses** — `id, customer_id, label, type ('main'|'shipping'|'billing'|'commercial'), is_default_shipping, is_default_billing, recipient, doc_number, zipcode, street, number, complement, district, city, state, country, latitude, longitude, reference, phone, created_at, updated_at`. Trigger garante 1 default por tipo.

### 2.3 Carrinho
- **carts** — `id, store_id, customer_id (NULL p/ guest), anonymous_token (UUID p/ guest), channel ('web'|'pos'|'app'|'b2b'), status ('active'|'merged'|'converted'|'abandoned'|'expired'), currency, price_list_id, coupon_code, shipping_address_id, billing_address_id, shipping_method, shipping_cost, subtotal, discount_total, tax_total, grand_total, items_count, notes, expires_at, abandoned_at, last_activity_at, created_at, updated_at`.
- **cart_items** — `id, cart_id, product_id, variant_id, color_id, sku, name_snapshot, image_snapshot, unit_price, list_price, discount_amount, quantity, line_total, attributes jsonb, added_at, updated_at`. UNIQUE `(cart_id, variant_id)`.
- **cart_coupons** — `cart_id, coupon_id, applied_value`.
- **cart_events** (opcional/leve) — auditoria de mudanças, ou apenas via `domain_events`.

### 2.4 Cupons / Promoções (base)
- **coupons** — `id, store_id, code UNIQUE per store, kind ('percent'|'fixed'|'free_shipping'|'gift'), value, min_order, max_uses, max_uses_per_customer, valid_from, valid_to, customer_group_filter, price_list_filter, category_filter, product_filter, stackable, status`.
- **coupon_redemptions** — `coupon_id, customer_id, order_id, redeemed_at`.

### 2.5 Pedidos
- **orders** — `id, store_id, number (sequencial por loja), customer_id, channel, type ('retail'|'wholesale'|'b2b'|'pos'), status (enum), payment_status, fulfillment_status, fiscal_status, price_list_id, currency, subtotal, discount_total, shipping_total, tax_total, grand_total, items_count, weight_total, salesperson_id, coupon_code, notes, internal_notes, source_cart_id, idempotency_key UNIQUE, placed_at, paid_at, shipped_at, delivered_at, cancelled_at, created_by, created_at, updated_at`.
- **order_items** — `id, order_id, product_id, variant_id, color_id, sku, name_snapshot, image_snapshot, unit_price, list_price, discount_amount, quantity, line_total, tax_breakdown jsonb, attributes jsonb, fulfilled_qty, returned_qty, status`.
- **order_addresses** — `order_id, role ('shipping'|'billing'), snapshot jsonb` (snapshot imutável).
- **order_status_history** — `order_id, from_status, to_status, reason, actor_user_id, metadata, created_at`.
- **order_notes** — `order_id, kind ('internal'|'customer'), body, created_by`.
- **order_coupons** — `order_id, coupon_id, value`.

Enum `order_status`: `draft, awaiting_payment, payment_approved, picking, packing, shipped, in_transit, delivered, cancelled, returned, exchanged`.
Enum `payment_status`: `pending, authorized, paid, partially_refunded, refunded, failed, chargeback`.
Enum `fulfillment_status`: `unfulfilled, partial, fulfilled, returned`.
Enum `fiscal_status`: `none, pending, issued, cancelled, rejected`.

### 2.6 Pagamentos
- **payments** — `id, order_id, provider ('mercadopago'|'manual'|'pix'|'boleto'|'card'|'store_credit'), method, status, amount, currency, installments, external_id, external_status, qr_code, qr_code_base64, barcode, ticket_url, authorization_code, card_brand, card_last4, holder_doc, fee_amount, net_amount, paid_at, expires_at, idempotency_key, raw_payload jsonb, created_at, updated_at`.
- **payment_events** — webhooks recebidos (`payment_id, source, event_type, payload, signature_ok, processed_at`).
- **refunds** — `id, payment_id, amount, reason, status, external_id, created_at`.

### 2.7 Expedição
- **shipments** — `id, order_id, carrier ('correios'|'transportadora'|'pickup'|'custom'), service_code ('PAC'|'SEDEX'|...), method, tracking_code, label_url, label_format, cost, declared_value, weight, dimensions jsonb, from_warehouse_id, to_address_snapshot jsonb, status ('pending'|'label_ready'|'dispatched'|'in_transit'|'delivered'|'returned'|'failed'), dispatched_at, delivered_at, created_at, updated_at`.
- **shipment_items** — `shipment_id, order_item_id, quantity`.
- **shipment_events** — eventos de rastreio (`shipment_id, code, description, location, occurred_at, source`).
- **shipping_methods** — catálogo por loja (`id, store_id, carrier, name, code, active, config jsonb`).
- **shipping_quotes** (cache, opcional) — `cart_id, carrier, service, cost, eta_days, fetched_at`.

### 2.8 Fiscal
- **invoices** — `id, order_id, store_id, number, series, access_key (44 dígitos), model ('55'|'65'), nature_operation, status (enum fiscal), issue_date, total, xml_url, danfe_url, protocol, cancel_reason, raw_payload jsonb, provider, external_id, created_at, updated_at`.
- **invoice_items** — `invoice_id, order_item_id, ncm, cfop, cest, taxes jsonb`.
- **invoice_events** — log de chamadas ao emissor externo.

### 2.9 Workflow Engine (genérico)
- **workflow_definitions** — `id, code UNIQUE, name, entity_type ('order'|'purchase_order'|'inventory_count'|'product'|'supplier'), version, active, config jsonb`.
- **workflow_states** — `id, definition_id, code, name, is_initial, is_final, sla_minutes, color, sort_order`.
- **workflow_transitions** — `id, definition_id, from_state_id, to_state_id, action_code, required_permission, guard_expression, auto, on_event`.
- **workflow_instances** — `id, definition_id, entity_type, entity_id, store_id, current_state_id, started_at, ended_at, context jsonb`.
- **workflow_history** — `id, instance_id, from_state_id, to_state_id, transition_id, actor_user_id, reason, metadata jsonb, occurred_at`.

A tabela `order_status` continua existindo como campo "rápido", mas o estado canônico vem do `workflow_instances` quando o pedido tiver workflow associado.

### 2.10 Área do Cliente
- **wishlists** — `id, customer_id, name, is_default, visibility ('private'|'public')`.
- **wishlist_items** — `wishlist_id, product_id, variant_id, added_at`.
- **returns** — `id, order_id, customer_id, kind ('return'|'exchange'), status, reason, refund_method, total_refund, created_at`.
- **return_items** — `return_id, order_item_id, quantity, reason, condition`.
- **customer_tickets** (opcional, base p/ SAC) — `id, customer_id, order_id, subject, status`.

### 2.11 Permissões / RBAC
Permissions novas (em `permissions`):
`customers.read/create/update/delete`, `carts.read/manage`, `orders.read/create/update/cancel/refund`, `payments.read/refund`, `shipments.read/create/update/cancel`, `invoices.read/issue/cancel`, `coupons.manage`, `returns.manage`, `workflow.manage`. Associadas a `admin` e `super_admin`; criar role `sales` (acesso a customers, carts, orders, shipments) e `support` (read + returns).

---

## 3. DER (visão lógica)

<lov-artifact url="/__l5e/documents/fase5_commercial_der.mmd" mime_type="text/vnd.mermaid"></lov-artifact>

---

## 4. Fluxograma — Checkout

```text
 [Carrinho ativo]
        │
        ▼
 ┌──────────────┐    não autenticado e exige login?
 │  Identificação│──────────────► [Login / Cadastro express] ──┐
 └──────┬───────┘                                              │
        │ autenticado/guest permitido                          │
        ▼                                                      │
 [Endereço de entrega] ◄────────────────────────────────────────┘
        │
        ▼
 [Cotação de frete: Correios / Transp / Retirada]
        │
        ▼
 [Seleção de pagamento: PIX | Cartão | Boleto | MP Checkout]
        │
        ▼
 [Revisão final + validação estoque + recálculo preço/cupom]
        │
        ├── falha (estoque/preço mudou) ──► [Alerta + volta ao carrinho]
        ▼
 [createOrderFromCart()  ── transação ──]
   • lock variantes
   • snapshot preços/imagens/endereços
   • cria order + items + addresses + workflow_instance
   • cria payment (status=pending) + idempotency_key
   • cart.status = converted
   • emit order.created
        │
        ▼
 [Redirect Mercado Pago / exibe PIX/Boleto]
        │
        ▼
 [Webhook MP] ──► payment.approved ──► order.payment_approved
        │
        ▼
 [Página de confirmação + e-mail]
```

---

## 5. Fluxograma — Pedidos (workflow)

```text
 draft ─► awaiting_payment ─► payment_approved ─► picking ─► packing
   │            │                    │                          │
   │            └──► cancelled       └──► cancelled             ▼
   │                                                        shipped
   ▼                                                            │
 cancelled                                                      ▼
                                                          in_transit
                                                                │
                                                                ▼
                                                            delivered
                                                                │
                                            ┌───────────────────┼─────────┐
                                            ▼                   ▼         ▼
                                        returned           exchanged   (final)
```
Cada transição: valida permissão, executa guards (estoque, pagamento), grava `order_status_history`, atualiza `workflow_instances`, emite domain event correspondente e dispara side-effects (gerar shipment, baixar estoque, gerar NF-e).

---

## 6. Fluxograma — Workflow Engine

```text
 trigger (server fn / webhook / cron)
        │
        ▼
 loadInstance(entity_type, entity_id)
        │
        ▼
 resolveTransition(current_state, action_code)
        │
        ├── não encontrado ─► erro
        ▼
 checkPermission(user, transition.required_permission)
        │
        ▼
 evalGuard(transition.guard_expression, context)
        │
        ├── falha ─► erro de regra
        ▼
 BEGIN TX
   update workflow_instances.current_state
   insert workflow_history
   run on_enter hooks (ex.: criar shipment)
   emit domain event (entity.state_changed)
 COMMIT
        │
        ▼
 schedule SLA / auto transitions
```

Hooks `on_enter` / `on_exit` são funções server-side registradas por código (`order.picking.on_enter` → cria tarefa de separação).

---

## 7. Server Functions (arquivo → fn)

`src/lib/business/customers.functions.ts`
- `listCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `archiveCustomer`, `mergeCustomers`, `setCustomerGroups`, `searchCustomersByDoc`.

`src/lib/business/customer-addresses.functions.ts`
- `listAddresses`, `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`.

`src/lib/business/carts.functions.ts`
- `getOrCreateCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, `clearCart`, `applyCoupon`, `removeCoupon`, `setShippingAddress`, `setBillingAddress`, `quoteShipping`, `mergeAnonymousCart`, `abandonCart`.

`src/lib/business/checkout.functions.ts`
- `startCheckout`, `validateCart`, `confirmCheckout` (cria pedido + pagamento).

`src/lib/business/orders.functions.ts`
- `listOrders`, `getOrder`, `createOrderManual` (admin/PDV), `updateOrderNotes`, `cancelOrder`, `transitionOrder` (delegado ao workflow), `addOrderItem` (pré-aprovação), `splitOrder`, `cloneOrder`.

`src/lib/business/payments.functions.ts`
- `createPayment`, `capturePayment`, `refundPayment`, `getPayment`, `mercadoPagoWebhook` (server route).

`src/lib/business/shipments.functions.ts`
- `createShipment`, `generateLabel`, `updateTracking`, `markDelivered`, `cancelShipment`, `quoteCorreios`.

`src/lib/business/invoices.functions.ts`
- `requestInvoice`, `cancelInvoice`, `getInvoiceXml`, `getInvoiceDanfe`, `invoiceWebhook`.

`src/lib/business/wishlists.functions.ts`, `returns.functions.ts`, `coupons.functions.ts`.

`src/lib/business/workflow.functions.ts`
- `getInstance`, `availableTransitions`, `applyTransition`, `listHistory`, `listDefinitions`.

Rotas públicas (server routes em `src/routes/api/public/`): `mercadopago.webhook`, `correios.webhook`, `invoice.webhook`, `cron.abandon-cart`, `cron.shipment-poll`.

---

## 8. Domain Events

`customer.created/updated/deleted/blocked`
`address.created/updated/deleted`
`cart.created/updated/item_added/item_removed/coupon_applied/abandoned/merged/converted`
`checkout.started/validated/completed/failed`
`order.created/updated/confirmed/cancelled/refunded`
`order.status_changed` (genérico, com from/to)
`order.payment_pending/payment_approved/payment_failed`
`order.picking_started/packing_started/shipped/in_transit/delivered/returned/exchanged`
`payment.created/authorized/approved/failed/refunded/chargeback`
`shipment.created/label_generated/dispatched/in_transit/delivered/failed`
`invoice.requested/issued/cancelled/rejected`
`coupon.redeemed`
`workflow.transition_applied`
`return.opened/approved/refunded/closed`

Todos persistidos via `emit_domain_event()` (já existente), consumidos por subscriptions em `domain_event_subscriptions`.

---

## 9. RLS (políticas por tabela)

Padrão geral (multi-loja):
- **SELECT**: `is_super_admin(auth.uid()) OR (store_id IN (select user_store_ids(auth.uid())) AND has_permission(auth.uid(), '<perm>.read', store_id))`.
- **INSERT/UPDATE/DELETE**: análogo com permission específica.

Casos especiais:
- **customers / customer_addresses / wishlists / returns / orders / payments / invoices**: além do staff, o próprio cliente acessa via `customers.auth_user_id = auth.uid()` (policy "self access" somente SELECT e UPDATE limitado a campos não sensíveis).
- **carts**: `customer_id = self` OR `anonymous_token = current_setting('request.headers')::json->>'x-cart-token'` (token validado no server fn; policy permite somente via service path).
- **shipments / shipment_events**: SELECT do cliente via join em `orders.customer_id`.
- **workflow_*** : SELECT por store; transições só via server fn com permission `workflow.manage` + permission da entidade.
- **coupons**: SELECT público de cupom ativo via server fn (não policy anon).
- **payments / invoices**: bloquear UPDATE pelo cliente; somente staff.

Toda tabela `public.*` deve ter GRANT para `authenticated` e `service_role`; `anon` apenas onde houver acesso público explícito (nenhum por padrão neste módulo — guest cart trafega via server fn com service role).

---

## 10. RBAC (permissões e roles)

Permissions novas (códigos): listadas em §2.11.
Roles sugeridos:
- `super_admin` — tudo (já existe).
- `admin` — tudo dentro da loja.
- `sales` — `customers.*`, `carts.*`, `orders.read/create/update`, `shipments.read/create/update`, `coupons.manage` parcial.
- `support` — `customers.read/update`, `orders.read/cancel`, `returns.manage`, `payments.read`.
- `fulfillment` — `orders.read`, `shipments.*`, `invoices.read`.
- `finance` — `orders.read`, `payments.*`, `invoices.*`.
- `customer` (implícito via `auth.users`) — sem entrada em `user_roles`; acesso via RLS self.

---

## 11. Performance / Escalabilidade

Premissas: 500k clientes, 5k pedidos/dia (~150k/mês), 20 lojas.

- Particionar `orders`, `order_items`, `payments`, `shipment_events`, `domain_events`, `audit_log` por `store_id` (hash) ou por `created_at` mensal quando o volume justificar.
- `orders.number` sequencial por loja via `sequences` dedicadas (`order_number_seq_<store_id>`), evitando lock global.
- Snapshots imutáveis (preço, endereço, imagem) em pedido para evitar joins em leitura histórica.
- Cache de carrinho ativo em memória de borda (Cloudflare KV/Workers cache) chaveado por `anonymous_token` / `customer_id`.
- Webhooks → fila lógica via `payment_events` / `shipment_events` + cron worker; processamento idempotente.
- Cron `cron.abandon-cart` percorre `carts` com `last_activity_at < now() - 1h` e marca `abandoned` em batch.
- Materialized view `mv_customer_stats` (LTV, pedidos, ticket médio) refresh diário.
- Materialized view `mv_sales_daily` por loja/canal para dashboard.
- Read-replica do Supabase para relatórios pesados.
- Limitar payload de `raw_payload` (compressão zstd JSONB) ou mover para storage após 90 dias.

---

## 12. Índices recomendados

- `customers (store_id, status)`, `(store_id, doc_number)`, `(auth_user_id)`, `GIN (to_tsvector(name || ' ' || email || ' ' || coalesce(legal_name,'')))`.
- `customer_addresses (customer_id, type, is_default_shipping)`.
- `carts (store_id, status, last_activity_at)`, `(customer_id, status)`, `(anonymous_token)`.
- `cart_items (cart_id)`, `(variant_id)`.
- `orders (store_id, status, placed_at DESC)`, `(customer_id, placed_at DESC)`, `(store_id, number)`, `(idempotency_key)`, `(payment_status)`, `(fulfillment_status)`.
- `order_items (order_id)`, `(variant_id)`, `(product_id)`.
- `payments (order_id)`, `(provider, external_id)`, `(status, created_at)`.
- `shipments (order_id)`, `(carrier, status)`, `(tracking_code)`.
- `shipment_events (shipment_id, occurred_at DESC)`.
- `invoices (order_id)`, `(store_id, number, series)`, `(access_key)`.
- `workflow_instances (entity_type, entity_id)`, `(store_id, current_state_id)`.
- `workflow_history (instance_id, occurred_at DESC)`.
- `domain_events (aggregate_type, aggregate_id, created_at DESC)`, `(event_type, created_at DESC)`.
- `coupons (store_id, code)`, `(valid_from, valid_to)`.
- `wishlist_items (wishlist_id, product_id)`.

---

## 13. Sugestões de melhoria antes da implementação

1. **Snapshot único `order_snapshot jsonb`** em `orders` além das tabelas relacionais — acelera leitura da fatura e isola de mudanças no catálogo.
2. **Tabela `order_totals_breakdown`** para impostos detalhados (preparar SPED/NF-e sem refatorar depois).
3. **`idempotency_keys` global** (tabela própria com TTL) usada por checkout, pagamentos e webhooks — evita pedido/pagamento duplicado em retries.
4. **Outbox pattern** real: gravar evento na mesma TX do estado e ter worker que publica para subscribers externos (Mercado Pago, e-mail, ERP). Já temos `domain_events`; adicionar coluna `delivered_at` e índice parcial `WHERE delivered_at IS NULL`.
5. **Workflow versionado**: ao alterar definição, congelar versão usada por instâncias existentes (`workflow_instances.definition_version`).
6. **Separar PDV/POS no futuro**: `orders.channel = 'pos'` já previsto, mas considerar tabela `pos_sessions` para fechamento de caixa (fora desta fase, mas deixar `channel` extensível).
7. **Reserva de estoque** no checkout: tabela `stock_reservations (variant_id, warehouse_id, cart_id|order_id, qty, expires_at)` para evitar oversell entre adicionar ao carrinho e pagar.
8. **Limites de crédito B2B**: validar `credit_limit` em `confirmCheckout` para `type='pj'` com `payment_terms`.
9. **i18n/moeda**: já há `currency` em cart/order; manter `numeric(14,4)` para preços, `numeric(14,2)` para totais.
10. **LGPD**: marcar campos PII e implementar `customer.anonymize()` (substitui dados sensíveis preservando histórico fiscal).
11. **Webhooks MP**: armazenar `signature` + verificação HMAC antes de processar; reusar pattern de `/api/public/*`.
12. **Frete**: começar com adapter `ShippingProvider` (interface) para permitir Correios, Melhor Envio, Frenet, transportadoras próprias sem mudar contrato.
13. **Returns/Trocas**: vincular ao `workflow_engine` desde o início (mesmo motor, definição `return_workflow`).
14. **Fiscal**: prever `invoice_provider_config` por loja (Focus NFe, eNotas, NFe.io) — só campos, sem código.
15. **Observabilidade**: adicionar `correlation_id` em todo server fn do checkout e propagar em `domain_events.metadata`.

---

## 14. Próximos passos (após aprovação)

1. Migration 1 — Clientes + Endereços + permissions + roles.
2. Migration 2 — Workflow Engine genérico + seeds de definições.
3. Migration 3 — Carrinho + Cupons + Reservas de estoque.
4. Migration 4 — Pedidos + histórico + outbox.
5. Migration 5 — Pagamentos + Mercado Pago adapter (apenas schema + server fn stub).
6. Migration 6 — Expedição + Correios adapter.
7. Migration 7 — Fiscal (schema + provider config).
8. Migration 8 — Área do cliente (wishlist, returns).
9. Camada UI por bloco, sempre consumindo server functions.

Aguardando sua revisão antes de iniciar qualquer implementação.

---

## 15. ✅ Fase 5.0 — Fundações Transversais (IMPLEMENTADA)

**Status:** concluída. Arquitetura congelada e aprovada.

### Migrations aplicadas
- `fase5_0_foundations.sql` — Workflow Engine (5 tabelas), Transactional Outbox (3 tabelas), Idempotency Keys (1 tabela), Observability Layer (6 tabelas: metrics, traces, health_checks, feature_flags, feature_flag_overrides, system_settings). 13 RPCs `SECURITY DEFINER` (enqueue/claim/mark outbox, idempotency_begin/complete/purge, record_metric/health, evaluate_feature_flag, release_stale_outbox_locks). 13 novas permissões RBAC, todas concedidas ao super_admin.
- `fase5_0_security_hardening.sql` — REVOKE EXECUTE de PUBLIC nas RPCs novas; GRANT a service_role/authenticated conforme escopo.

### Jobs pg_cron agendados (via supabase--insert)
- `release-outbox-locks` (a cada 1min) — libera locks expirados.
- `purge-idempotency` (a cada 1h) — remove chaves expiradas (status ≠ in_flight).
- Workers HTTP do dispatcher de outbox serão agendados na Fase 5.1+ quando houver URL publicada.

### Camada TypeScript (helpers reutilizáveis)
- `src/lib/foundations/events.ts` — catálogo de event types e aggregate types do módulo comercial.
- `src/lib/foundations/outbox.functions.ts` — `enqueueOutbox()` + server fns `listOutbox`, `listDeadLetter`.
- `src/lib/foundations/idempotency.functions.ts` — `withIdempotency()` wrapper + `hashRequest()`.
- `src/lib/foundations/observability.functions.ts` — `recordMetric`, `recordHealth`, server fns `evaluateFlag`, `getSetting`.
- `src/lib/foundations/workflow.functions.ts` — `startWorkflow()`, `transitionWorkflow()` + server fn `getWorkflowForAggregate`.

### Próximos passos
Iniciar **Fase 5.1 — Clientes** (customers, customer_addresses, customer_contacts, customer_tax_profiles, customer_credit_ledger, customer_groups_map) na próxima aprovação.
