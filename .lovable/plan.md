# Refinamentos Customer Hub (5.1+) e Arquitetura Fase 5.2

## Parte A — Refinamentos do Customer Hub (compatíveis com 5.1)

Sem quebrar contratos existentes. Tudo aditivo: novas tabelas/colunas + novas server functions + novas abas na página `admin.customers`.

### A.1 Schema (migration única)

**Novas colunas em `customers`:**
- `score` int default 0 — Customer Score calculado
- `score_updated_at` timestamptz
- `internal_notes` text — observações internas (visível só a staff)
- `consent_marketing_email` bool default false
- `consent_marketing_sms` bool default false
- `consent_marketing_whatsapp` bool default false
- `consent_data_processing` bool default false
- `consent_updated_at` timestamptz

**Novas colunas em `customer_addresses`:**
- `latitude` numeric(10,7)
- `longitude` numeric(10,7)
- `geocoded_at` timestamptz
- `geocode_provider` text
- `geocode_precision` text — `rooftop|interpolated|approximate|city`

**Novas tabelas:**
- `customer_tags` (store_id, name, color, slug) — catálogo de tags por loja
- `customer_tag_map` (customer_id, tag_id) — M:N
- `customer_notes` (id, customer_id, author_user_id, body, pinned, created_at) — feed de observações com autoria/timestamp (complementa `internal_notes` rápido)
- `customer_consents_log` (id, customer_id, channel, granted, source, ip, user_agent, created_at) — auditoria imutável de mudanças de consentimento (LGPD)
- `customer_score_factors` (customer_id, factor_code, value, weight, computed_at) — explicação do score
- `customer_timeline_view` (VIEW) — UNION ALL de:
  - `domain_events` (aggregate_type='customer')
  - `customer_credit_ledger`
  - `customer_notes`
  - `audit_log` (entity='customers'|'customer_addresses'|'customer_contacts')
  - placeholder para futuros: orders, carts, tickets

Todas com GRANT, RLS por `has_permission('customers.*', store_id)` + `is_super_admin`.

### A.2 Score (regra inicial, parametrizável depois)

Função SQL `recompute_customer_score(_customer_id uuid)` (SECURITY DEFINER):
- +10 por endereço completo
- +10 por email + telefone
- +20 se tem compras (placeholder até Fase 5.3)
- +15 consentimento marketing
- +10 segmento `vip`
- -30 status `blocked`
- -20 crédito negativo

Resultado escrito em `customers.score` + linhas em `customer_score_factors`.
Trigger leve em `customer_addresses`, `customer_contacts`, `customer_credit_ledger` chama recompute (assíncrono via outbox para evitar overhead — emite `customer.score.recompute_requested`).

### A.3 Server Functions adicionais (`customers.functions.ts`)

- `getCustomer360(customerId)` — agrega customer + addresses + contacts + tax + credit balance + tags + notes (top 10) + score + factors
- `getCustomerTimeline(customerId, { cursor, limit })` — paginado da view
- `listTags(storeId)` / `upsertTag` / `deleteTag`
- `assignTags(customerId, tagIds[])` / `removeTag`
- `addNote(customerId, body, pinned?)` / `pinNote` / `deleteNote`
- `updateConsents(customerId, consents)` — grava em `customers` + insert em `customer_consents_log`
- `setAddressGeolocation(addressId, { lat, lng, provider, precision })`
- `requestScoreRecompute(customerId)` — enfileira no outbox

### A.4 UI (`admin.customers`)

Detalhe do cliente vira layout abas:
- **Visão 360°** — header com score, badges (tags, segmento, status), KPIs (crédito, total pedidos placeholder, ticket médio placeholder), endereços resumidos.
- **Timeline** — feed unificado paginado.
- **Notas** — composer + lista (pin/unpin/delete).
- **Tags** — chips com autocomplete do catálogo da loja.
- **Consentimentos** — toggles LGPD + histórico.
- **Endereços** — mantém CRUD atual + mostra status de geocoding (pending/done) com botão "Geocodificar" (stub para Fase futura quando provider for plugado).
- **Crédito** — mantém ledger atual.

Tudo isolado em componentes pequenos sob `src/components/customers/`.

---

## Parte B — Fase 5.2: Carrinho, Reserva de Estoque e Cotações de Frete

Núcleo do checkout. Construído sobre as fundações 5.0 (Outbox, Idempotency, Feature Flags, Observability, Workflows) e o Customer Hub 5.1.

### B.1 Domínios e responsabilidades

```text
┌─────────────────────────────────────────────────────────────┐
│ CART DOMAIN                                                  │
│  carts ──┬── cart_items                                      │
│          ├── cart_adjustments (cupons, descontos)            │
│          ├── cart_shipping_quotes                            │
│          └── cart_events (audit local rápido)                │
│                                                              │
│ STOCK DOMAIN                                                 │
│  stock_reservations ── reserva temporária por variant        │
│  (consome de stock_levels via funções SECURITY DEFINER)      │
│                                                              │
│ PROMOTION DOMAIN                                             │
│  coupons ── coupon_redemptions                               │
│                                                              │
│ SHIPPING DOMAIN                                              │
│  shipping_carriers ── shipping_quotes (cache por CEP+peso)   │
│  shipping_rules (peso/dimensão/região)                       │
└─────────────────────────────────────────────────────────────┘
```

### B.2 Tabelas (resumo)

**carts**
- id, store_id, customer_id NULL (anônimo), anonymous_token NULL, status (`active|abandoned|converted|expired`), currency, subtotal, discount_total, shipping_total, grand_total, customer_group_id NULL, price_list_id NULL, selected_shipping_quote_id NULL, expires_at, last_activity_at
- Único parcial: `(customer_id) WHERE status='active'` e `(anonymous_token) WHERE status='active'`

**cart_items**
- cart_id, product_id, variant_id, qty, unit_price (snapshot), list_price, applied_price_list_id, line_total, reservation_id NULL

**cart_adjustments**
- cart_id, kind (`coupon|manual|auto_promo`), code, amount, percentage, target (`cart|item`), item_id NULL

**stock_reservations**
- id, store_id, variant_id, warehouse_id, qty, cart_id, customer_id NULL, status (`active|consumed|released|expired`), expires_at, created_at
- Idempotente via `idempotency_keys` scope=`stock.reserve`

**coupons**
- store_id, code (unique by store), kind (`percent|fixed|free_shipping`), value, min_subtotal, max_redemptions, redemptions_count, valid_from, valid_until, applies_to (jsonb: categories/products/customer_groups), stackable, active

**coupon_redemptions**
- coupon_id, cart_id, customer_id, redeemed_at, amount_applied

**shipping_carriers**
- store_id, code, name, active, config jsonb (api endpoint, token ref → secret)

**shipping_rules** (fallback offline / loja local)
- carrier_id, region (uf/cep range), weight_min/max, base_price, per_kg, eta_days_min/max

**cart_shipping_quotes**
- cart_id, carrier_id, service_code, price, eta_days_min, eta_days_max, raw jsonb, fetched_at, selected bool

Todas com GRANT, RLS por `has_permission('cart.*'|'shipping.*'|'promotions.*', store_id)`, e policies específicas:
- `carts`: dono (customer_id = auth.uid()) OU staff com permissão.
- `carts` anônimos: leitura/escrita via server function que valida `anonymous_token` (não exposto direto pela Data API).

### B.3 Server functions (`cart.functions.ts`, `shipping.functions.ts`, `coupons.functions.ts`, `stock.functions.ts`)

**Carrinho**
- `getOrCreateCart({ anonymousToken? })` — usa auth se logado, senão token
- `addItem({ cartId, variantId, qty })` — valida estoque, reserva, snapshot preço (price_list resolvido por customer_group)
- `updateItemQty` / `removeItem`
- `mergeCartsOnLogin({ anonymousToken })` — chamado no `onAuthStateChange SIGNED_IN`; soma quantidades, mantém preços do carrinho persistido, libera reservas duplicadas
- `applyCoupon({ cartId, code })` / `removeCoupon`
- `recalculateCart(cartId)` — recomputa subtotal/descontos/frete

**Estoque**
- `reserveStock({ variantId, qty, cartId, ttlSeconds })` — idempotente, atômico (UPDATE com `WHERE available_qty >= qty`)
- `releaseReservation(reservationId)`
- `expireReservations()` — job (server fn chamado por pg_cron via `/api/public/jobs/expire-reservations`)
- Trigger em `stock_reservations` ajusta `stock_levels.reserved_qty`

**Frete**
- `quoteShipping({ cartId, postalCode })` — itera carriers ativas, chama adapters, persiste em `cart_shipping_quotes`, cache 15min
- `selectShippingQuote({ cartId, quoteId })`
- `simulateDelivery({ postalCode, items })` — variante sem cart (PDP)
- Adapters em `src/lib/business/shipping/adapters/` — interface comum, primeira impl `OfflineRulesAdapter` (lê `shipping_rules`); placeholders para Correios/Melhor Envio plugáveis depois via secret.

**Cupons**
- `validateCoupon({ cartId, code })` — checa janela, min, segmento, max
- CRUD admin

### B.4 Workflow

Workflow `cart_lifecycle` (seed via migration): `active → checkout_started → reserved → paid → converted` com ramos `abandoned`, `expired`. Apenas estados; instâncias criadas quando carrinho entra em checkout.

### B.5 Outbox / Domain Events

Emitidos via `enqueue_outbox_event`:
- `cart.created`, `cart.item.added`, `cart.item.removed`, `cart.coupon.applied`, `cart.merged`
- `stock.reserved`, `stock.released`, `stock.reservation.expired`
- `shipping.quoted`, `shipping.selected`
- `cart.abandoned` (após N min sem atividade — job)

### B.6 Idempotência

Scopes:
- `cart.add_item` (key = cart_id + variant_id + client_request_id)
- `stock.reserve` (key = cart_id + variant_id)
- `coupon.apply` (key = cart_id + code)
- `shipping.quote` (key = cart_id + postal_code, TTL curto)

### B.7 Observability

Métricas (`record_metric`):
- `cart.created`, `cart.abandoned.rate`, `cart.conversion.rate`
- `stock.reservation.active.count`, `stock.reservation.expired.count`
- `shipping.quote.latency_ms` por carrier
- `coupon.redemption.count`

Health check: `cart_engine`, `shipping_providers`.

### B.8 Feature flags

- `cart.enable_anonymous` (default true)
- `cart.enable_merge_on_login` (default true)
- `shipping.enable_live_quotes` (default false até carriers configuradas)
- `promotions.enable_stackable_coupons` (default false)

### B.9 Estrutura de arquivos

```text
src/lib/business/
├── repositories/
│   ├── carts.server.ts
│   ├── stock-reservations.server.ts
│   ├── coupons.server.ts
│   └── shipping.server.ts
├── services/
│   ├── carts.server.ts          # regras: merge, recalc, snapshot preço
│   ├── stock.server.ts          # reserva atômica
│   ├── pricing.server.ts        # resolve price_list por customer_group
│   ├── promotions.server.ts     # validação cupom
│   └── shipping.server.ts       # orquestra adapters
├── shipping/adapters/
│   ├── index.ts                 # interface
│   └── offline-rules.adapter.ts
├── cart.functions.ts
├── stock.functions.ts
├── coupons.functions.ts
└── shipping.functions.ts

src/routes/
├── _authenticated/admin.coupons.tsx
├── _authenticated/admin.shipping.tsx
└── api/public/jobs/
    ├── expire-reservations.ts
    └── mark-abandoned-carts.ts   # chamados por pg_cron com secret header
```

### B.10 Ordem de implementação proposta

1. Migration única 5.2 (todas as tabelas + workflow seed + feature flags)
2. Pricing service (resolve price_list por customer_group) — base p/ resto
3. Stock reservation (atomic, idempotent, trigger em stock_levels)
4. Cart core (create/add/update/remove + recalc + snapshot)
5. Anonymous + merge on login
6. Coupons (CRUD + apply/remove)
7. Shipping (adapter interface + offline rules + quote cache)
8. Outbox events em todos os pontos
9. Jobs públicos (expire reservations / abandon)
10. UIs admin (cupons, shipping rules); UI carrinho fica para Fase 5.3 (Checkout)

---

## O que NÃO entra nesta fase

- UI de carrinho do storefront (Fase 5.3 — Checkout)
- Pagamento (Fase 5.4)
- Integração real com Correios/Melhor Envio (plugável via adapter quando carriers forem configuradas)
- Geocoding real de endereços (apenas estrutura preparada)

---

**Aprovação solicitada:**
1. Refinamentos Customer Hub (Parte A) — aprovo migration + código?
2. Arquitetura Fase 5.2 (Parte B) — aprovo para iniciar pela migration?
