# Performance Baseline & SLOs

> **Status:** Baseline v1.0 — congelado em 2026-06-21.
> **Revisão:** mensal, ou quando teste arquitetural falhar.

## 1. SLOs por operação (p95)

| Operação | SLO p95 | SLO p99 | Métrica fonte |
|---|---:|---:|---|
| `placeOrderFromCart` | 600 ms | 1.2 s | `order.placed.duration_ms` |
| `authorizePayment` | 1.5 s | 3.0 s | `payment.authorize.duration_ms` |
| `capturePayment` | 800 ms | 1.5 s | `payment.capture.duration_ms` |
| `refundPayment` | 1.5 s | 3.0 s | `payment.refund.duration_ms` |
| `createFulfillment` | 400 ms | 800 ms | `fulfillment.created` |
| `createShipment` (com etiqueta) | 2.0 s | 4.0 s | `shipment.created` |
| `getOrder360` | 250 ms | 500 ms | `order.get360.duration_ms` |
| `searchOrders` (full-text) | 350 ms | 700 ms | `order.search.duration_ms` |
| `dashboardKpis` (uso de rollup) | 250 ms | 500 ms | `order.dashboard.kpi.duration_ms` |
| `cart_apply_pricing` | 150 ms | 300 ms | `pricing.duration` |
| `quoteShipping` | 1.5 s | 3.0 s | `shipping.quote.duration` |
| `applyCoupon` | 120 ms | 250 ms | `coupon.validation.duration` |
| `mergeAnonymousCart` | 400 ms | 800 ms | `cart.merge.duration_ms` |
| `evaluateRules` (por trigger) | 80 ms | 200 ms | `order.rule.evaluation.duration_ms` |
| `acquireLock` | 30 ms | 80 ms | `order.lock.acquire.duration_ms` |

## 2. SLOs de pipelines (lag/freshness)

| Pipeline | SLO | Métrica |
|---|---|---|
| Outbox publish lag (p95) | < 5 s | `outbox.order_events.backlog` |
| Métricas horárias freshness | < 15 min | `order_metrics.lag_minutes` |
| Search index freshness | < 30 s (trigger) / < 5 min (job reconciliação) | `order_search_index.lag_seconds` |
| Webhook de carrier → timeline | < 30 s | `orders.payment_webhook_lag` |
| Reservation expiration sweep | < 60 s do TTL | `stock.reservation.expire_lag` |

## 3. Limites de volume (alarmes amarelos)

| Métrica | Limite | Ação |
|---|---:|---|
| `event_outbox` pendentes | > 10 000 | escalar workers |
| `event_outbox_dead_letter` | > 100/dia | investigar adapter |
| `idempotency_keys` ativas | > 1 M | revisar TTL por scope |
| Reservas ativas concorrentes | > 50 000 | revisar TTL + capacidade |
| `order_timeline` linhas/mês | > 30 M | iniciar particionamento |
| `metrics` linhas/dia | > 50 M | acionar archive |

## 4. Estratégias de performance ativas

- **Denormalização controlada:** `order_search_index`, `customer.tags_cache`, `order_metrics_daily/hourly`.
- **BRIN** em colunas temporais (`placed_at`, `occurred_at`).
- **Índices parciais** para casos quentes (holds não resolvidos, SLAs pendentes, locks ativos).
- **Particionamento preparado** (não ativado) em `order_timeline`, `order_ledger`, `event_outbox`, `metrics`.
- **Rollup hierárquico** (horário alimenta diário).
- **`SELECT FOR UPDATE` + version optimistic lock** em mutações concorrentes.
- **Lock Manager aplicacional** para processos longos cross-request.
- **Debounce** de recompute de score (1/min por entidade).
- **Worker outbox horizontal** com `claim_outbox_batch` (skip locked).

## 5. Testes de carga obrigatórios (pré-go-live)

| Cenário | Carga alvo | Aceite |
|---|---|---|
| `placeOrderFromCart` em rajada | 200 RPS por 5 min | p95 < SLO, 0 duplicatas |
| `capturePayment` reentrante (webhook 3x) | 100 RPS por 3 min | exatamente 1 captura efetiva |
| `searchOrders` com 1 M de pedidos | 50 RPS sustained | p95 < SLO |
| Outbox draining sob falha de adapter | 5 000 eventos enfileirados | retry com backoff, DLQ correta |
| Reservation contention | 500 reservas simultâneas no mesmo SKU | nenhuma over-reservation |

Ferramenta: k6. Scripts vivem em `tests/load/` (a serem criados antes do go-live da F5.3).

## 6. Métricas-chave a expor no admin

Dashboard padrão (alimenta-se de `order_metrics_hourly/daily`):
- GMV (24h, 7d, 30d) e AOV
- Funnel: carts → checkouts → orders → paid → shipped → delivered
- Lead times: pagamento → envio, envio → entrega
- Refund rate, return rate, cancellation rate
- Holds ativos por tipo, breaches de SLA por tipo
- Tier distribution dos pedidos por score
- Latência p95 das operações críticas

## 7. Política de revisão

- Métricas violando SLO por 2 dias consecutivos disparam **Performance Review** (issue no repo).
- Mudança estrutural que altere SLO requer atualização deste arquivo + ADR.
- Testes em `tests/architecture/` impedem regressão estrutural (não de performance — esta cabe a k6 + alarmes).
