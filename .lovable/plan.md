# Fase 6.0 — Admin Platform (Arquitetura Definitiva)

> Auditoria + projeto. Nada implementado. Painel orientado a módulos, consumindo **exclusivamente** a Business Layer via `createServerFn` (`*.functions.ts`). Zero acesso direto a tabelas, zero chamadas a `*.server.ts` do client, zero SQL no front.

---

## 1. Auditoria — Inventário Atual

### Aggregates / Domínios
Catalog (products, variants, attributes, attribute-values, brands, categories, category-attributes, collections, tags), DAM (assets, folders, versions, tags), Pricing (price_lists, price_list_items, customer_groups), Promotions (coupons, ledger, redemptions), Inventory (stock_levels, movements, reservations, counts, transfers, warehouses), Purchasing (suppliers, purchase_orders, goods_receipts, cost_history), Cart (carts, items, snapshots, coupons, timeline), Orders (orders, items, splits, holds, notes, timeline, audit, ledger, fulfillments, returns, locks, snapshots), Payments (gateways, adapters, transactions, attempts, refunds, chargebacks, reconciliations, webhook_inbox, documents), Fulfillment (fulfillments, items, packages, pick_lists, shipments, tracking_events, delivery_attempts), Shipping (carriers, zones, methods, rates, quotes, labels, snapshots), Fiscal (providers, invoices, events, webhook_inbox), Customers (customers, addresses, contacts, notes, tags, groups, consents, credit_ledger, tax_profiles, notification_prefs, portal_sessions), Support (tickets, messages, attachments, categories, watchers, SLA, events), Notifications (templates, channels, deliveries, subscriptions), Workflow (definitions, states, transitions, instances, history), Outbox (event_outbox, dead_letter, delivery_log, subscriptions, domain_events), Observability (metrics, traces, audit_log, system_logs, health_checks, idempotency_keys), Platform (stores, profiles, roles, permissions, role_permissions, user_roles, feature_flags, system_settings).

### Engines / Registries
- **PaymentEngine** — `services/payments/{adapter,registry,provider-registry,providers/*}` + `payments.server.ts` + `payments.functions.ts`. Webhook: `/api/public/hooks/mercadopago`.
- **ShippingEngine** — `services/shipping/{adapter,registry,provider-registry,providers/*,labels,tracking,carrier-accounts,cep}` + `shipping.server.ts` + `shipping*.functions.ts`.
- **FiscalEngine** — `services/fiscal/{adapter,registry,provider-registry,providers/*}` + `fiscal.server.ts` + `fiscal.functions.ts`. Webhook: `/api/public/hooks/nuvemfiscal`.

### Services existentes
products, product-children, attributes, attribute-values, category-attributes, assets (DAM), pricing, coupons, customers, customer-hub, inventory, stock-reservation, purchases, suppliers, cart, cart-merge, payments, shipping, fiscal, master, permissions.

### Server Functions já expostas
cart, customers, customer-groups, products, product-children, attributes, attribute-values, brands, categories, category-attributes, collections, coupons, dam, inventory, payments, price-lists, purchases, shipping, shipping-carriers, shipping-tracking, suppliers, fiscal.

### Telas Admin existentes
products, products/$id/edit, categories, brands, collections, attributes, attribute-values, category-attributes, dam, customers (+detail), customer-groups, price-lists, coupons, suppliers, carts, shipping, admin index. **Lacunas:** Orders, Payments, Fulfillment, Fiscal, Inventory, Purchases, Support, Notifications, Workflow Console, Outbox, Observability, Platform/RBAC, Reports.

### RBAC (permissions já existentes — confirmar em runtime)
Padrão `<domain>.<action>` (ex.: `fiscal.view|issue|cancel|audit`, `payments.*`, `shipping.*`). Plataforma usa `has_permission(uid, perm)` + `has_role(uid, role)` + `is_super_admin`.

---

## 2. Princípios Arquiteturais do Painel

1. **Module-first**: cada módulo = pasta de rotas `_authenticated/admin.<module>.*` + hooks + componentes locais. Sem cross-import entre módulos exceto via Business Layer.
2. **Data shape canônica**: `loader → ensureQueryData(queryOptions)` + `useSuspenseQuery` (TanStack Query). Mutations via `useServerFn` + `useMutation` + `queryClient.invalidateQueries`.
3. **RBAC no client = UX**: esconder/desabilitar via `usePermissions()`. Autorização real é sempre server-side (RPC SECURITY DEFINER / middleware).
4. **Listas**: tabela virtualizada, server-side pagination/sort/filter, multi-select com **bulk actions** delegando a Server Functions.
5. **Detalhes**: layout 3 zonas — header (status + ações), abas (overview/timeline/audit/relacionados), side panel (metadados/links).
6. **Estados UI padronizados**: `loading | empty | error | forbidden | partial | success`. Skeletons por módulo. `ErrorBoundary` + `NotFound` em toda rota com loader.
7. **Auditoria**: toda ação destrutiva ou de estado abre Confirm Dialog com diff + motivo; persistida via Outbox/audit_log do domínio.
8. **Observability hook**: cada módulo expõe widget "Health" (latência média, error rate, fila Outbox por evento).
9. **Workflow-aware**: módulos com FSM (Orders, Fulfillment, Payments, Fiscal, Support) renderizam ações apenas para transições válidas obtidas do WorkflowService.
10. **Feature flags**: gating de telas novas via `feature_flags` + overrides.

---

## 3. Catálogo de Módulos

Para cada módulo: **objetivo · telas · componentes · RBAC · Server Fns · Services · Workflows · métricas · integrações · estados · filtros · bulk · auditoria · roadmap**.

### 3.1 Catalog (Products / Variants / Children)
- **Obj**: gestão completa de SKUs, variantes, atributos, herança pai/filho.
- **Telas**: list, detail/edit (tabs: básico, mídia, atributos, variantes, preço, estoque, SEO, relacionados), bulk import, lixeira.
- **Componentes**: ProductTable, VariantMatrix, AttributeAssignmentPanel, MediaPicker (DAM), SeoPanel, ChildrenTree.
- **RBAC**: `catalog.view|create|update|delete|publish`.
- **Server Fns**: products.*, product-children.*, attributes.*, attribute-values.*, category-attributes.*, brands.*, categories.*, collections.*.
- **Services**: products, product-children, attributes, attribute-values, category-attributes, assets.
- **Workflows**: lifecycle draft→active→archived.
- **Métricas**: ativos, sem mídia, sem preço, sem estoque, sem SEO.
- **Integrações**: DAM, Pricing, Inventory.
- **Estados/Filtros**: status, brand, category, collection, hasMedia, hasPrice, stockBand, updatedRange.
- **Bulk**: publish/unpublish, set category/brand, tag, archive, export CSV.
- **Auditoria**: snapshot por edit (audit_log).
- **Roadmap**: 6.1.

### 3.2 DAM
- **Obj**: biblioteca central de mídia + versões + tags.
- **Telas**: explorer (folders+grid), upload, asset detail (versions, links, tags), uploads jobs.
- **Componentes**: FolderTree, AssetGrid, UploadDropzone, VersionTimeline, LinksPanel.
- **RBAC**: `dam.view|upload|update|delete`.
- **Server Fns**: dam.* (upload-job, list, tag, link).
- **Services**: assets.
- **Workflows**: upload_job FSM (pending→processing→ready|failed).
- **Métricas**: storage usado, jobs falhos, assets órfãos.
- **Filtros**: folder, tag, mime, size, hasLinks.
- **Bulk**: move, tag, delete, regenerate variants.
- **Roadmap**: 6.1 (já parcialmente existe — completar versions + jobs).

### 3.3 Pricing (Price Lists + Customer Groups)
- **Obj**: B2B/B2C pricing por grupo.
- **Telas**: price list (list/detail/items), customer-groups (já existe), assignments.
- **RBAC**: `pricing.view|update`. **Server Fns**: price-lists.*, customer-groups.*. **Service**: pricing.
- **Bulk**: import CSV, markup global, copy list.
- **Roadmap**: 6.2.

### 3.4 Promotions (Coupons)
- **Telas**: coupons list/edit, ledger, redemptions, A/B.
- **RBAC**: `promotions.view|create|update|disable`. **Server Fns**: coupons.*. **Service**: coupons.
- **Métricas**: redenção/dia, GMV impactado, abuso.
- **Roadmap**: 6.2.

### 3.5 Inventory
- **Obj**: estoque multi-warehouse + reservas + contagens + transfers.
- **Telas**: stock por SKU, warehouses, movements, reservations, counts, transfers, low-stock.
- **Componentes**: StockMatrix, MovementTimeline, ReservationDrawer, CountSession, TransferWizard.
- **RBAC**: `inventory.view|adjust|count|transfer|reserve`.
- **Server Fns**: inventory.*. **Services**: inventory, stock-reservation.
- **Workflows**: count (open→counting→reconciled), transfer (draft→in_transit→received).
- **Métricas**: ruptura, dias de cobertura, acuracidade.
- **Bulk**: adjust, recount, transfer.
- **Roadmap**: 6.1 (mínimo: stock view + adjust + reservations).

### 3.6 Purchasing
- **Telas**: suppliers (existe), purchase-orders, goods-receipts, cost-history.
- **RBAC**: `purchasing.view|create|approve|receive`. **Server Fns**: purchases.*, suppliers.*. **Service**: purchases, suppliers.
- **Workflows**: PO (draft→approved→sent→partially_received→received→closed).
- **Roadmap**: 6.3.

### 3.7 Cart (Operations)
- **Telas**: carts list (existe), cart detail, abandonment, recovery.
- **RBAC**: `cart.view|recover`. **Server Fns**: cart.*. **Service**: cart, cart-merge.
- **Métricas**: abandono, ticket médio, time-to-purchase.
- **Roadmap**: 6.2.

### 3.8 Orders (OMS) — CRÍTICO
- **Obj**: cockpit do OMS.
- **Telas**: orders list, order detail (overview, items, payments, shipments, fiscal, holds, notes, timeline, audit, returns), splits, holds, assignments, returns.
- **Componentes**: OrderHeader (status badges + workflow actions), ItemsTable, PaymentsPanel, ShipmentsPanel, FiscalPanel, HoldsPanel, TimelineFeed, AuditDrawer, ReturnWizard, SplitWizard.
- **RBAC**: `orders.view|update|cancel|hold|release|split|refund|assign|note`.
- **Server Fns**: a criar `orders.functions.ts` expondo: list, get, transition, hold, release, addNote, assign, split, requestPayment (delega Payments), requestShipment (delega Fulfillment), requestInvoice (delega Fiscal), requestReturn.
- **Services**: novo `orders.server.ts` orquestrador; consome payments/shipping/fiscal/inventory/customers via Business Layer.
- **Workflows**: order FSM completa (created→paid→fulfilling→shipped→delivered→completed; cancel/hold/return ramos).
- **Métricas**: SLA por status, backlog, pendências de pagamento/fiscal/envio.
- **Integrações**: Payments, Fulfillment, Shipping, Fiscal, Notifications, Customers, Outbox.
- **Estados**: loading/empty/error/forbidden/partial/locked.
- **Filtros**: status, payment_status, fiscal_status, fulfillment_status, store, channel, dateRange, tag, hold, valueBand, customer.
- **Bulk**: capture payment, request fiscal, request label, assign, tag, cancel (com motivo), export.
- **Auditoria**: `order_audit` + Outbox events.
- **Roadmap**: 6.1 (mínimo MVP: list, detail, transition, payments view, shipment trigger, fiscal trigger).

### 3.9 Payments
- **Telas**: payments list, payment detail (attempts, refunds, chargebacks, webhooks, reconciliation, documents, timeline, notes), gateways/adapters, reconciliations, chargebacks, webhook inbox.
- **Componentes**: PaymentStatusBadge, AttemptsTimeline, RefundDialog, ChargebackPanel, GatewayHealthCard, WebhookInboxTable, ReconciliationViewer.
- **RBAC**: `payments.view|refund|capture|void|reconcile|admin`.
- **Server Fns**: payments.* (estender com refund, capture, reconcile, listWebhooks, retryWebhook).
- **Service**: payments + PaymentProviderRegistry.
- **Workflows**: payment FSM (pending→authorized→captured→settled; refund branch; chargeback branch).
- **Métricas**: taxa aprovação por gateway, latência adapter, fila de webhooks, reconciliação pendente.
- **Integrações**: Mercado Pago (atual); Stripe/Asaas/PagSeguro (futuros) plugáveis no Registry.
- **Bulk**: retry webhook, retry capture, mark reconciled.
- **Auditoria**: payment_events + Outbox.
- **Roadmap**: 6.2.

### 3.10 Fulfillment
- **Telas**: fulfillments list, fulfillment detail (items, packages, pick_list, shipment, tracking, delivery attempts), pick_lists, packing station, shipments, tracking board.
- **RBAC**: `fulfillment.view|pick|pack|ship|cancel`.
- **Server Fns**: a criar `fulfillment.functions.ts` (list, get, transition, generatePickList, packPackage, shipPackage, voidLabel, reprintLabel).
- **Service**: a criar `fulfillment.server.ts` consumindo Shipping (label/quote/tracking) e Inventory (reservation/decrement).
- **Workflows**: fulfillment (pending→picking→packed→shipped→delivered; failure branches).
- **Métricas**: TTship, taxa de erro pick, SLA carrier.
- **Bulk**: print labels, mark shipped, retry delivery.
- **Roadmap**: 6.2.

### 3.11 Shipping (Admin de Gateway)
- **Telas**: carriers/accounts (parcial existe), zones, methods, rates, quotes simulator, labels, tracking inspector, webhook inbox.
- **RBAC**: `shipping.view|configure|simulate|label|admin`. **Service**: shipping + ShippingProviderRegistry.
- **Server Fns**: shipping.*, shipping-carriers.*, shipping-tracking.*.
- **Métricas**: quote latency, label success, tracking sync lag.
- **Roadmap**: 6.2 (completar gestão administrativa).

### 3.12 Fiscal
- **Telas**: invoices list, invoice detail (events, XML/DANFE, webhooks), providers, CC-e, cancelamentos, contingência.
- **RBAC**: `fiscal.view|issue|cancel|audit`. **Service**: fiscal + FiscalProviderRegistry.
- **Server Fns**: fiscal.* (issue, cancel, sendCCe, fetchStatus, listWebhooks).
- **Workflows**: invoice (pending→authorized|denied; cancelled, corrected).
- **Métricas**: taxa autorização, SEFAZ latency, denials por motivo.
- **Roadmap**: 6.2.

### 3.13 Customers (CRM-lite)
- **Telas**: existe list+detail; expandir: consents log, credit ledger, tax profiles, notification prefs, portal sessions, contacts, notes, tags, groups, score factors.
- **RBAC**: `customers.view|update|merge|anonymize|credit|impersonate`.
- **Server Fns**: customers.*, customer-groups.* (estender: merge, anonymize, creditAdjust).
- **Service**: customers, customer-hub.
- **Métricas**: NPS proxy, LTV, recência, churn.
- **LGPD**: anonymize + consents audit.
- **Roadmap**: 6.2.

### 3.14 Support (Help Desk)
- **Telas**: tickets list, ticket detail (messages, attachments, SLA, watchers, events, assignment), categories, SLA policies, macros.
- **RBAC**: `support.view|reply|assign|close|sla_admin`.
- **Server Fns**: a criar `support.functions.ts`.
- **Service**: a criar `support.server.ts`.
- **Workflows**: ticket (open→pending→resolved→closed; reopen branch) + SLA timers.
- **Métricas**: FRT, resolution time, breach rate.
- **Roadmap**: 6.3.

### 3.15 Notifications
- **Telas**: templates, channels, deliveries, subscriptions, dead-letter.
- **RBAC**: `notifications.view|template_edit|channel_admin|resend`.
- **Server Fns**: a criar `notifications.functions.ts`. **Service**: novo `notifications.server.ts`.
- **Workflows**: delivery FSM (queued→sent→delivered|bounced|failed).
- **Métricas**: bounce rate, latência por canal.
- **Bulk**: resend, suppress.
- **Roadmap**: 6.3.

### 3.16 Workflow Console
- **Telas**: definitions, states, transitions visualizer, instances list, instance detail (state history), retry/force-transition.
- **RBAC**: `workflow.view|admin|override`.
- **Server Fns**: a criar `workflow.functions.ts`.
- **Métricas**: stuck instances, transitions/min.
- **Roadmap**: 6.3.

### 3.17 Outbox & Domain Events
- **Telas**: outbox monitor, dead-letter, subscriptions, delivery log, replay.
- **RBAC**: `outbox.view|replay|admin`.
- **Server Fns**: a criar `outbox.functions.ts`.
- **Métricas**: backlog, oldest pending, fail rate por tipo.
- **Roadmap**: 6.3.

### 3.18 Observability
- **Telas**: metrics explorer, traces, system_logs, audit_log search, health checks, idempotency inspector, slow queries.
- **RBAC**: `observability.view|admin`.
- **Server Fns**: a criar `observability.functions.ts`.
- **Roadmap**: 6.4.

### 3.19 Platform / RBAC / Settings
- **Telas**: stores, users, roles, permissions matrix, role_permissions, user_roles, feature_flags, system_settings, store_settings.
- **RBAC**: `platform.admin` (super_admin obrigatório p/ roles/permissions).
- **Server Fns**: a criar `platform.functions.ts` (gated).
- **Roadmap**: 6.4.

### 3.20 Reports & Dashboards
- **Telas**: home dashboard executivo, vendas, estoque, fiscal, financeiro, operação.
- **Server Fns**: a criar `reports.functions.ts` (consome views agregadas).
- **Roadmap**: 6.4.

---

## 4. Padrões Transversais (aplicar em todo módulo)

- **Shell**: `admin.tsx` (layout + nav lateral + breadcrumbs + busca global + user menu + store switcher).
- **Hooks**: `usePermissions`, `useStoreContext`, `useFeatureFlag`, `useWorkflowActions(entity)`, `useAuditTrail(entity,id)`, `useOutboxHealth(eventType)`.
- **Componentes base**: `DataTable` (server-driven), `FilterBar`, `BulkActionBar`, `StatusBadge`, `WorkflowActions`, `TimelineFeed`, `AuditDrawer`, `ConfirmDialog (com motivo)`, `MetricCard`, `EmptyState`, `ForbiddenState`, `ErrorState`.
- **Loader pattern**: `ensureQueryData` + `useSuspenseQuery`; `errorComponent` + `notFoundComponent` em toda rota.
- **Mutations**: `useServerFn` + `useMutation` + invalidate. Toast padronizado. Idempotency-key em ações sensíveis.
- **Bulk**: seleção persistente cross-page; ação enfileirada no Outbox quando >50 itens.
- **Auditoria**: toda ação destrutiva grava `audit_log` + dispara Outbox event `<domain>.<action>`.
- **Telemetria UI**: `recordMetric("admin.<module>.<action>")` via Server Fn fina.

---

## 5. Roadmap em Fases (mínimo para colocar a loja de roupas em produção primeiro)

**MVP de produção = vender + cobrar + faturar + entregar + atender.** Logo: Catalog ✅, Inventory mínimo, Orders, Payments view, Fulfillment trigger, Fiscal trigger, Customers view.

### Fase 6.1 — Core Operacional (BLOQUEANTE p/ go-live)
1. Shell admin v2 + DataTable + FilterBar + BulkActionBar + hooks base (`usePermissions`, `useWorkflowActions`).
2. **Orders MVP**: `orders.functions.ts` + `orders.server.ts` (orquestrador) + list + detail (overview/items/payments-readonly/shipments-readonly/fiscal-readonly/timeline) + transitions + holds + notes + assign + cancel.
3. **Inventory MVP**: stock view por SKU/warehouse, adjust manual, reservations list, low-stock.
4. **Catalog gap-fill**: variants matrix, SEO panel, media via DAM no editor.
5. **DAM gap-fill**: upload jobs status + versions.

### Fase 6.2 — Comercial & Financeiro
6. **Payments admin**: list, detail, refund, retry webhook, gateways health.
7. **Fulfillment**: pick list, pack, ship (gera label via ShippingEngine), tracking board.
8. **Shipping admin**: zones, methods, rates, quote simulator, label inspector.
9. **Fiscal admin**: invoices list/detail, issue/cancel/CC-e, providers, webhook inbox.
10. **Pricing + Promotions**: price-lists completos + coupons analytics.
11. **Customers expand**: consents, credit ledger, anonymize, merge.
12. **Cart ops**: abandonment + recovery.

### Fase 6.3 — Pós-venda & Plataforma
13. **Support** (tickets + SLA).
14. **Notifications** (templates + deliveries + dead-letter).
15. **Purchasing** (PO + goods receipts + cost history).
16. **Workflow Console**.
17. **Outbox monitor + replay**.

### Fase 6.4 — Governança & Insight
18. **Observability** (metrics/traces/logs/audit).
19. **Platform/RBAC/Settings** (roles, permissions, feature flags, stores, system_settings).
20. **Reports & Dashboards** executivos.

---

## 6. Critérios de Aceite (por fase)
- 100% das telas consomem **somente** `*.functions.ts`.
- Toda rota tem `errorComponent` + `notFoundComponent`.
- Toda ação destrutiva passa por Confirm + grava audit + emite Outbox event.
- Permissões verificadas client (UX) **e** server (autoritativo).
- Métricas e health-cards visíveis por módulo.
- Zero acoplamento a provider específico em qualquer tela (Payments/Shipping/Fiscal usam apenas as capabilities do Registry).

---

## 7. Pontos preparados para o futuro
- Novos gateways de pagamento/envio/fiscal: basta registrar adapter no Registry — telas continuam idênticas.
- Multi-store: store switcher no shell já contempla.
- Multi-canal: orders/fulfillment já abstraem `channel`.
- LGPD: anonymize + consents prontos para incorporar a fluxos de DSR.

Aguardando aprovação para iniciar **Fase 6.1**.
