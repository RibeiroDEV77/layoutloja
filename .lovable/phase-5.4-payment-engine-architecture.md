# Fase 5.4 — Payment Engine (Arquitetura Técnica)

> Documento de auditoria. **Nenhuma migration, código, tela ou Server Function deve ser implementada nesta fase.**
> Após aprovação, iniciaremos a **Migration 1/3**.

---

## 1. Visão Geral

O **Payment Engine** é um módulo enterprise, **desacoplado do Order Engine**, responsável exclusivamente pelo ciclo financeiro de um pedido (ou de qualquer Aggregate pagável no futuro: assinatura, recarga de wallet, gift card, etc.).

### Princípios arquiteturais

| Princípio | Implementação |
|---|---|
| **Separation of Concerns** | Order Engine = Aggregate de negócio. Payment Engine = Aggregate financeiro. Comunicação via Domain Events + FKs fracas (`payable_type`/`payable_id`). |
| **Adapter Pattern** | Toda integração com PSP passa por uma interface única `PaymentAdapter`. Services jamais conhecem MercadoPago, Stripe, Asaas. |
| **Append-only** | `payment_attempts`, `payment_transactions`, `payment_events`, `payment_reconciliation` nunca sofrem UPDATE de dados históricos. |
| **Idempotência** | Toda operação externa (charge, refund, webhook) usa `idempotency_key` derivado de `(adapter, external_id, operation)`. |
| **Transactional Outbox** | Todo evento de domínio é gravado no mesmo transaction da escrita de estado e publicado pelo dispatcher já existente. |
| **Observabilidade nativa** | `correlation_id` + `trace_id` propagam em 100% das tabelas operacionais. |
| **Extensibilidade** | `payable_type` polimórfico (`order`, `subscription`, `wallet_topup`, `marketplace_split`) permite novos casos sem remodelagem. |

### Posicionamento no ecossistema

```text
              ┌───────────────────┐
              │   Order Engine    │  (Aggregate principal)
              └─────────┬─────────┘
                        │ payment.requested / order.paid / order.refunded
                        ▼
              ┌───────────────────┐         ┌────────────────────┐
              │  Payment Engine   │◀───────▶│ Workflow Engine    │
              │  (Aggregate)      │ states  │ (workflow_instances)│
              └────┬────────┬─────┘         └────────────────────┘
                   │        │
                   │        └────▶  Outbox  ────▶ Subscribers (OMS, Email, BI)
                   │
                   ▼
         ┌──────────────────────┐
         │ PaymentAdapter (IF)  │
         ├──────────────────────┤
         │ MercadoPagoAdapter   │
         │ StripeAdapter        │
         │ PagSeguroAdapter     │
         │ AsaasAdapter         │
         │ MockAdapter (tests)  │
         └──────────────────────┘
```

---

## 2. DER Completo

```text
                                payments (Aggregate Root)
                                    │ 1
                ┌───────────────────┼──────────────────────────────┐
                │                   │                              │
              N │                 N │                            N │
       payment_attempts   payment_transactions             payment_allocations
                │                   │                              │
                │ 1                 │ 1                            │
              N │                 N │                              │
        payment_events ◀──── payment_refunds                       │
                │                   │                              │
                │                 N │                              │
                │           payment_chargebacks                    │
                │                   │                              │
                └──────────┬────────┘                              │
                           │                                       │
                       N   ▼                                   N   ▼
                 payment_documents                  order_payment_allocations (OMS)
                           │
                       N   ▼
                   payment_notes

   payments ──1──N── payment_metadata
   payments ──1──N── payment_reconciliation
   payments ──1──1── workflow_instances (workflow_definitions = "payment.v1")

   webhook_events ──N──1── payments  (via correlation)
   webhook_events ──1──N── payment_attempts (replay-safe)

   payment_gateways  ──1──N── payment_gateway_credentials
   payments         ──N──1── payment_gateways
```

---

## 3. Modelagem — Tabelas

> Convenção: toda tabela em `public.*`, `id UUID PK default gen_random_uuid()`, `created_at`/`updated_at TIMESTAMPTZ`, `store_id UUID NOT NULL` (multi-tenant), `correlation_id UUID`, `trace_id TEXT` quando operacional.

### 3.1 `payments` — Aggregate Root

| Finalidade | Representa a intenção de pagamento de um Aggregate (order/subscription/etc). Um pedido pode ter N payments (ex: split, retry após falha). |
|---|---|
| **Campos principais** | `store_id`, `payable_type ENUM('order','subscription','wallet_topup','marketplace_split')`, `payable_id UUID`, `status payment_status`, `currency CHAR(3)`, `amount_gross NUMERIC(18,4)`, `amount_net`, `amount_fee`, `amount_refunded`, `amount_captured`, `method payment_method`, `gateway_id`, `external_id`, `customer_id`, `idempotency_key`, `expires_at`, `authorized_at`, `captured_at`, `paid_at`, `failed_at`, `cancelled_at`, `refunded_at`, `closed_at`, `metadata JSONB`, `correlation_id`, `trace_id`, `created_by`, `version INT` (optimistic lock) |
| **FKs** | `gateway_id → payment_gateways.id`, `customer_id → customers.id`, `store_id → stores.id` |
| **Índices** | `(store_id, status)`, `(payable_type, payable_id)`, `UNIQUE(gateway_id, external_id)`, `UNIQUE(idempotency_key)`, `(customer_id, created_at DESC)`, partial `(status) WHERE status IN ('pending','authorized')` |
| **Constraints** | `amount_gross > 0`, `amount_refunded <= amount_captured`, `currency IN (...)`, `status` válido (trigger), `version >= 0` |
| **Triggers** | `update_updated_at`, `payments_status_transition_guard` (valida máquina de estados), `payments_emit_outbox` (after insert/update), `payments_version_bump` |
| **RLS** | SELECT: staff com `payments.read` + escopo `store_id`; cliente vê seus próprios via `customer_id = current_customer()`. INSERT/UPDATE: somente via Server Function (`SECURITY DEFINER`). |
| **RBAC** | `payments.read`, `payments.create`, `payments.capture`, `payments.cancel` |

### 3.2 `payment_attempts` — Tentativas (append-only)

| Finalidade | Cada chamada ao adapter (autorização, retry, fallback de gateway) é uma attempt imutável. |
|---|---|
| **Campos** | `payment_id`, `attempt_no INT`, `adapter TEXT`, `gateway_id`, `operation ENUM('authorize','capture','cancel','refund','query','tokenize')`, `request_payload JSONB`, `response_payload JSONB`, `http_status INT`, `gateway_status TEXT`, `error_code TEXT`, `error_message TEXT`, `latency_ms INT`, `started_at`, `finished_at`, `retry_of UUID`, `correlation_id`, `trace_id`, `idempotency_key` |
| **Índices** | `(payment_id, attempt_no)`, `UNIQUE(payment_id, attempt_no)`, `UNIQUE(idempotency_key)`, `(adapter, gateway_status)`, `(started_at)` BRIN |
| **Constraints** | `attempt_no >= 1`, `latency_ms >= 0`, payloads criptografados em colunas sensíveis (PAN nunca persistido — apenas `last4`/`brand`). |
| **Triggers** | `prevent_update_or_delete` (append-only), `attach_correlation` |
| **RLS** | SELECT: `payments.audit`. INSERT: `SECURITY DEFINER` somente. |

### 3.3 `payment_transactions` — Movimentos financeiros (append-only)

| Finalidade | Ledger financeiro do payment. Cada movimento monetário concreto. |
|---|---|
| **Campos** | `payment_id`, `kind ENUM('authorization','capture','cancel','refund','partial_refund','chargeback','adjustment','fee','settlement')`, `amount NUMERIC(18,4)`, `currency`, `direction ENUM('credit','debit')`, `external_id`, `gateway_id`, `parent_transaction_id UUID`, `occurred_at`, `posted_at`, `settlement_date DATE`, `attempt_id UUID`, `metadata JSONB`, `correlation_id`, `trace_id` |
| **Índices** | `(payment_id, occurred_at)`, `(kind)`, `UNIQUE(gateway_id, external_id, kind)`, `(settlement_date)` |
| **Constraints** | `amount > 0`, soma de captures - refunds == `payments.amount_captured - amount_refunded` (verificado por trigger consistency `payments_balance_invariant`). |
| **Triggers** | `prevent_update_or_delete`, `payments_balance_invariant`, `payment_transaction_to_outbox` |
| **RLS** | SELECT: `payments.read`/`payments.audit`; INSERT: definer only. |

### 3.4 `payment_events` — Catálogo interno (append-only)

| Finalidade | Espelho local dos eventos de domínio emitidos (para timeline da UI). O outbox é a fonte de verdade para entrega externa. |
|---|---|
| **Campos** | `payment_id`, `event_type TEXT`, `actor_type ENUM('system','user','gateway','webhook','workflow')`, `actor_id`, `payload JSONB`, `occurred_at`, `correlation_id`, `trace_id` |
| **Índices** | `(payment_id, occurred_at DESC)`, `(event_type)` |
| **RLS** | SELECT: `payments.read`; INSERT: definer only. |

### 3.5 `payment_metadata`

| Finalidade | Key/value extensível por payment (UTM, device, ip, antifraude scores, etc). |
|---|---|
| **Campos** | `payment_id`, `namespace TEXT`, `key TEXT`, `value JSONB`, `is_pii BOOLEAN`, `is_secret BOOLEAN` |
| **Índices** | `UNIQUE(payment_id, namespace, key)` |
| **RLS** | Colunas `is_pii`/`is_secret` filtradas por `payments.audit`. |

### 3.6 `payment_allocations`

| Finalidade | Quanto de um payment foi alocado a quais entidades do OMS (order items, shipping, taxes, splits, marketplace). |
|---|---|
| **Campos** | `payment_id`, `target_type ENUM('order_item','shipping','tax','discount','marketplace_seller','platform_fee')`, `target_id UUID`, `amount`, `currency`, `metadata JSONB` |
| **Índices** | `(payment_id)`, `(target_type, target_id)` |
| **Constraints** | `SUM(amount) per payment_id <= payments.amount_captured` (trigger). |

### 3.7 `payment_reconciliation`

| Finalidade | Conciliação entre transações internas e arquivo de settlement do PSP (CSV/API diária). |
|---|---|
| **Campos** | `payment_id`, `transaction_id`, `gateway_id`, `external_settlement_id`, `expected_amount`, `received_amount`, `diff_amount`, `fee_amount`, `status ENUM('matched','missing_internal','missing_external','divergent','disputed')`, `reconciled_at`, `reconciled_by`, `source_file`, `raw_record JSONB` |
| **Índices** | `(status)`, `(gateway_id, external_settlement_id)`, `(reconciled_at)` |
| **RLS** | `payments.reconcile`. |

### 3.8 `payment_refunds`

| Finalidade | Cabeçalho de pedidos de refund (parcial/total), com fluxo de aprovação. |
|---|---|
| **Campos** | `payment_id`, `amount`, `currency`, `reason_code TEXT`, `reason_note TEXT`, `status ENUM('requested','approved','rejected','processing','completed','failed')`, `requested_by`, `approved_by`, `approved_at`, `external_id`, `gateway_response JSONB`, `correlation_id` |
| **Índices** | `(payment_id)`, `(status)`, `UNIQUE(gateway_id, external_id)` |
| **Constraints** | `amount > 0 AND amount <= payments.amount_captured - amount_refunded` (trigger). |
| **Triggers** | `refund_state_machine`, `refund_emit_outbox`, ao `completed` → cria `payment_transactions(kind=refund|partial_refund)`. |
| **RLS** | `payments.refund`. |

### 3.9 `payment_chargebacks`

| Finalidade | Disputa iniciada pelo banco/portador. |
|---|---|
| **Campos** | `payment_id`, `external_id`, `reason_code`, `network_code`, `amount`, `currency`, `status ENUM('opened','under_review','evidence_required','won','lost','expired','closed')`, `opened_at`, `due_at`, `closed_at`, `evidence_submitted_at`, `outcome_notes`, `gateway_response JSONB` |
| **Índices** | `(payment_id)`, `(status)`, `(due_at) WHERE status IN ('evidence_required','under_review')` |
| **Triggers** | `chargeback_state_machine`, ao `lost` → `payment_transactions(kind=chargeback)`. |
| **RLS** | `payments.chargeback`. |

### 3.10 `payment_documents`

| Finalidade | Comprovantes, boletos, QR PIX, evidências de chargeback, NFs vinculadas. Usa `assets`. |
|---|---|
| **Campos** | `payment_id`, `chargeback_id NULL`, `refund_id NULL`, `kind ENUM('receipt','boleto_pdf','pix_qrcode','chargeback_evidence','invoice','other')`, `asset_id`, `external_url`, `expires_at`, `metadata JSONB` |
| **Índices** | `(payment_id, kind)` |

### 3.11 `payment_notes`

| Finalidade | Notas internas operacionais (similar a `order_notes`). |
|---|---|
| **Campos** | `payment_id`, `author_id`, `visibility ENUM('internal','customer')`, `body TEXT`, `pinned BOOLEAN` |
| **RLS** | `payments.read` (interno); cliente só vê `visibility='customer'`. |

### 3.12 `payment_gateways` (config)

| Finalidade | Catálogo de PSPs habilitados por store. |
|---|---|
| **Campos** | `store_id`, `adapter TEXT` (`mercadopago`,`stripe`,...), `display_name`, `is_active`, `priority INT`, `supported_methods payment_method[]`, `supported_currencies CHAR(3)[]`, `capabilities JSONB` (`{authorize_capture:true, partial_refund:true, ...}`), `config JSONB` (não-sensível), `webhook_secret_ref TEXT` (apontador para secret store), `created_by` |
| **Índices** | `UNIQUE(store_id, adapter, display_name)` |
| **RLS** | `payments.audit` ou role admin. **Nunca expor credenciais** — vivem em secret store (env), não no JSONB. |

### 3.13 `payment_gateway_credentials` (opcional, se multi-conta por store)

> Apenas **referências** (`secret_key_ref`, `public_key_ref`) — nunca os valores. Valores ficam em Vault/Env. RLS estrita: `payments.audit` + service_role apenas para reads server-side via SECURITY DEFINER.

### 3.14 `webhook_events` — Webhook Engine

| Finalidade | Toda notificação recebida de PSP. Append-only com replay. |
|---|---|
| **Campos** | `gateway_id`, `adapter TEXT`, `external_event_id TEXT`, `event_type TEXT`, `signature TEXT`, `signature_valid BOOLEAN`, `received_at`, `processed_at`, `status ENUM('received','validated','duplicated','processing','processed','failed','replayed')`, `raw_headers JSONB`, `raw_body TEXT`, `parsed_payload JSONB`, `payment_id NULL`, `attempt_id NULL`, `error TEXT`, `retry_count INT`, `correlation_id`, `trace_id` |
| **Índices** | `UNIQUE(adapter, external_event_id)` (idempotência), `(status, received_at)`, `(payment_id)` |
| **Triggers** | `prevent_update_of_raw_body`, ao `processed` enfileira no outbox. |
| **RLS** | `payments.audit`. INSERT: rota pública assinada `/api/public/webhooks/:adapter` (SECURITY DEFINER após verificar HMAC). |

### 3.15 `payment_idempotency_keys`

> Reusar tabela global `idempotency_keys` existente, com `namespace='payments'`.

### 3.16 Enums

```text
payment_status     : pending, authorized, partially_captured, captured, paid,
                     partially_refunded, refunded, failed, cancelled,
                     chargeback, closed
payment_method     : pix, credit_card, debit_card, boleto, wallet,
                     bank_transfer, store_credit, gift_card
refund_status      : requested, approved, rejected, processing, completed, failed
chargeback_status  : opened, under_review, evidence_required, won, lost, expired, closed
attempt_operation  : authorize, capture, cancel, refund, query, tokenize
transaction_kind   : authorization, capture, cancel, refund, partial_refund,
                     chargeback, adjustment, fee, settlement
```

---

## 4. Payment Adapters (Interface)

### 4.1 Contrato `PaymentAdapter`

```text
interface PaymentAdapter {
  readonly id: string                       // 'mercadopago' | 'stripe' | ...
  readonly capabilities: AdapterCapabilities

  authorize(input: AuthorizeInput): Promise<AdapterResult<AuthorizeOutput>>
  capture (input: CaptureInput):   Promise<AdapterResult<CaptureOutput>>
  cancel  (input: CancelInput):    Promise<AdapterResult<CancelOutput>>
  refund  (input: RefundInput):    Promise<AdapterResult<RefundOutput>>
  query   (input: QueryInput):     Promise<AdapterResult<QueryOutput>>

  verifyWebhookSignature(req: RawWebhookRequest): WebhookVerification
  parseWebhookEvent(req: RawWebhookRequest): NormalizedWebhookEvent

  // Optional surfaces (declared via capabilities)
  tokenize?(input: TokenizeInput): Promise<AdapterResult<TokenizeOutput>>
  fetchSettlementReport?(date: string): Promise<SettlementRecord[]>
}
```

Toda resposta retorna `AdapterResult` normalizado:
`{ ok, normalizedStatus, externalId, raw, error?, latencyMs, idempotent }`.

### 4.2 Hierarquia

```text
PaymentAdapter (abstract contract)
 ├── MercadoPagoAdapter    (pix, card, boleto, wallet)
 ├── StripeAdapter         (card, wallet — futura LATAM/global)
 ├── PagSeguroAdapter      (card, boleto, pix)
 ├── AsaasAdapter          (pix, boleto, card, subscriptions)
 └── MockAdapter           (tests + fixtures determinísticos)
```

**Regra**: nenhum Server Function importa SDKs do PSP. Toda chamada passa por `paymentAdapterRegistry.get(adapterId)`.

### 4.3 Mercado Pago — superfícies

| Feature | Mapping |
|---|---|
| **PIX** | `authorize → /v1/payments` (payment_method_id=pix); QR code → `payment_documents(kind=pix_qrcode)`; expiração via `expires_at`. |
| **Cartão** | Auth + capture (auto ou manual via capability `manual_capture`); 3DS quando disponível. |
| **Boleto** | `authorize → /v1/payments` (ticket); PDF salvo em `payment_documents(kind=boleto_pdf)`. |
| **Wallet** | Mercado Pago wallet via preference. |
| **Webhook** | `/api/public/webhooks/mercadopago` — HMAC `x-signature` + `x-request-id`. |
| **Refund** | `POST /v1/payments/:id/refunds` (total/parcial). |
| **Chargeback** | Polling `chargebacks_v1` + webhook `topic=chargebacks`. |
| **Consulta** | `query → GET /v1/payments/:id` (usado em reconciliação e em recovery). |
| **Reconciliação** | `fetchSettlementReport(date)` → `/v1/account/release_report`. |

---

## 5. Webhook Engine

### Fluxo

```text
POST /api/public/webhooks/:adapter
        │
        ▼
┌──────────────────────┐
│ 1. Raw capture       │  → INSERT webhook_events (status='received', raw_body, headers)
├──────────────────────┤
│ 2. Verify signature  │  → adapter.verifyWebhookSignature() → status='validated' | 'failed'
├──────────────────────┤
│ 3. Idempotency check │  → UNIQUE(adapter, external_event_id) → status='duplicated' (200 OK)
├──────────────────────┤
│ 4. Parse + persist   │  → parsed_payload + link payment_id
├──────────────────────┤
│ 5. Workflow dispatch │  → workflow.transition() (payment.v1)
├──────────────────────┤
│ 6. Outbox emit       │  → payment.webhook.received + state events
├──────────────────────┤
│ 7. Respond 200 ASAP  │  → processing assíncrono (background trigger)
└──────────────────────┘
```

### Replay seguro

Server Function admin `payments.webhook.replay(webhook_event_id)`:
- valida que `signature_valid = true`
- gera novo `correlation_id`
- reexecuta steps 4→6 com `status='replayed'`
- nunca duplica `payment_transactions` (idempotência por `external_id`)

---

## 6. Workflow

`workflow_definitions(slug='payment.v1')` — não duplica estados do OMS, mas se integra via eventos.

```text
        ┌──────────┐
        │ pending  │
        └────┬─────┘
             │ authorize OK
             ▼
       ┌────────────┐
       │ authorized │────┐  partial capture
       └────┬───────┘    ▼
            │      ┌────────────────────┐
            │      │ partially_captured │
            │      └────────┬───────────┘
            │ capture       │ final capture
            ▼               ▼
        ┌──────────┐
        │ captured │ ────────► paid (after settlement)
        └────┬─────┘
             │ refund (partial / full)
             ▼
       ┌────────────────────┐    ┌────────────┐
       │ partially_refunded │───►│ refunded   │
       └────────────────────┘    └─────┬──────┘
                                       │
   (any time) ──► failed / cancelled / chargeback ──► closed
```

Transições aplicadas apenas via Server Functions; trigger `payments_status_transition_guard` rejeita transição inválida.

---

## 7. Domain Events (catálogo)

| Evento | Disparado quando |
|---|---|
| `payment.created` | INSERT em `payments` |
| `payment.pending` | status → pending |
| `payment.authorized` | status → authorized |
| `payment.captured` | status → captured |
| `payment.partially_captured` | capture parcial |
| `payment.paid` | settlement confirmado |
| `payment.failed` | attempt final falhou |
| `payment.cancelled` | cancelado antes de capture |
| `payment.refund.requested` | `payment_refunds` criado |
| `payment.refund.approved` / `rejected` / `completed` / `failed` | mudança de status do refund |
| `payment.partially_refunded` / `refunded` | reflexo no aggregate |
| `payment.chargeback.created` | abertura |
| `payment.chargeback.evidence_submitted` | upload de provas |
| `payment.chargeback.won` / `lost` / `closed` | conclusão |
| `payment.webhook.received` | toda webhook validada |
| `payment.reconciled` | conciliação `matched` |
| `payment.reconciliation.divergent` | diff detectado |

Todos com envelope padrão `{ event_id, event_type, aggregate_id, aggregate_type, occurred_at, version, correlation_id, trace_id, payload }`.

---

## 8. Transactional Outbox

- Reusa `event_outbox` existente.
- Toda escrita em `payments`/`payment_*` emite via trigger `*_emit_outbox` na mesma transação.
- Ordenação por `(aggregate_id, version)`.
- Idempotência: `UNIQUE(event_id)`.
- Dispatcher externo já existente faz delivery; falhas vão para `event_outbox_dead_letter`.

---

## 9. Server Functions previstas

Sob `src/lib/payments/*.functions.ts` (client-safe path) com auth middleware:

| Function | Permissão | Descrição |
|---|---|---|
| `createPayment` | `payments.create` | Cria payment para um payable, escolhe gateway via política. |
| `authorizePayment` | `payments.create` | Chama adapter.authorize. |
| `capturePayment` | `payments.capture` | Captura total/parcial. |
| `cancelPayment` | `payments.cancel` | Cancela autorização. |
| `requestRefund` | `payments.refund` | Cria `payment_refunds` (workflow de aprovação). |
| `approveRefund` / `rejectRefund` | `payments.refund` | Aprovação 4-eyes. |
| `executeRefund` | `payments.refund` | Chama adapter.refund. |
| `listPayments` / `getPayment` | `payments.read` | Listagem com filtros + RLS. |
| `getPaymentTimeline` | `payments.read` | Junta events/attempts/transactions. |
| `submitChargebackEvidence` | `payments.chargeback` | Upload + status. |
| `replayWebhook` | `payments.audit` | Replay seguro. |
| `runReconciliation` | `payments.reconcile` | Importa settlement report. |
| `getPaymentMetrics` | `payments.audit` | Métricas agregadas. |

Rotas HTTP públicas (em `src/routes/api/public/webhooks/*.ts`):
- `POST /api/public/webhooks/mercadopago`
- `POST /api/public/webhooks/stripe`
- `POST /api/public/webhooks/pagseguro`
- `POST /api/public/webhooks/asaas`

---

## 10. RLS (resumo)

| Tabela | SELECT | INSERT/UPDATE |
|---|---|---|
| `payments` | `payments.read` (scoped to store) **OR** `customer_id = current_customer()` | SECURITY DEFINER via Server Function |
| `payment_attempts` | `payments.audit` | DEFINER only |
| `payment_transactions` | `payments.read` / `payments.audit` | DEFINER only (append-only) |
| `payment_events` | `payments.read` | DEFINER only |
| `payment_metadata` | `payments.read`; PII/secret só com `payments.audit` | DEFINER only |
| `payment_allocations` | `payments.read` | DEFINER only |
| `payment_refunds` | `payments.read`/`payments.refund` | DEFINER only |
| `payment_chargebacks` | `payments.chargeback` | DEFINER only |
| `payment_documents` | `payments.read`; customer vê seus próprios receipts | DEFINER only |
| `payment_notes` | staff `payments.read`; customer apenas `visibility='customer'` | staff via Server Function |
| `payment_gateways` | `payments.audit` | admin role |
| `payment_gateway_credentials` | service_role only | service_role only |
| `webhook_events` | `payments.audit` | rota pública verificada + DEFINER |
| `payment_reconciliation` | `payments.reconcile`/`payments.audit` | DEFINER only |

Anon: **nenhum acesso direto**. Cliente autenticado: apenas via `customer_id`.

---

## 11. RBAC (permissions)

| Permission | Descrição |
|---|---|
| `payments.read` | Listar/visualizar payments do escopo |
| `payments.create` | Criar e autorizar |
| `payments.capture` | Capturar autorizações |
| `payments.cancel` | Cancelar autorizações |
| `payments.refund` | Solicitar/aprovar/executar refunds |
| `payments.chargeback` | Gerenciar disputas |
| `payments.reconcile` | Executar/visualizar conciliação |
| `payments.audit` | Acessar attempts, raw payloads, metadata sensível, gateways, webhook events |

Atribuídas via tabela `role_permissions` existente.

---

## 12. Performance

- **Índices**: ver cada tabela; BRIN em `(created_at)`/`(occurred_at)` para append-only volumosos.
- **Particionamento**: `payment_attempts`, `payment_transactions`, `payment_events`, `webhook_events` particionados por `RANGE(created_at)` mensal (preparado em design, executado quando volume justificar).
- **Materialized views**:
  - `mv_payment_metrics_daily(store_id, date, gateway, method, approval_rate, capture_rate, refund_rate, chargeback_rate, avg_latency_ms, volume)`.
  - `mv_reconciliation_status_daily`.
  - Refresh CONCURRENTLY via cron.
- **Search**: `payments_search` (à la `orders_search`) com `tsvector` de `external_id`, `customer_email`, `payable_id`.
- **High volume**: outbox dispatcher em lotes; webhook ingestion responde 200 ASAP e processa em background.
- **Hot path**: trigger `payments_balance_invariant` usando soma incremental (delta), não recompute total.

---

## 13. Extensibilidade

| Cenário futuro | Como o design já suporta |
|---|---|
| **Novo gateway** | Implementar `PaymentAdapter` + registrar em `payment_gateways`. Zero migration de schema. |
| **Assinaturas** | `payable_type='subscription'`; tabela `subscriptions` futura referencia `payments`. |
| **Parcelamento** | Campos `installments INT` + `installment_amount` em `payment_attempts.request_payload` e refletido em `payments.metadata` (sem alterar core). |
| **Split payment / marketplace** | `payment_allocations(target_type='marketplace_seller')` + adapter capability `split`. |
| **Wallet interna** | `MockAdapter`-like `InternalWalletAdapter`; `payment_method='wallet'`/`store_credit`. |
| **Cashback** | `payment_transactions(kind='adjustment', direction='credit')` → emite evento `wallet.credited`. |
| **Gift card** | `payment_method='gift_card'`, adapter dedicado, alocação parcial via `payment_allocations`. |
| **Crédito da loja** | Mesma via wallet interna + `customer_credit_ledger` já existente. |

---

## 14. Fluxogramas-chave

### 14.1 Checkout — PIX

```text
[Client] ──createPayment──▶ [SF] ──authorize──▶ [Adapter MP] ──HTTP──▶ Mercado Pago
                              │                                          │
                              │◀──── normalizedResult (qr_code) ─────────┘
                              ▼
                          payments(status=pending)
                          payment_attempts(authorize)
                          payment_documents(pix_qrcode)
                          OUTBOX: payment.created, payment.pending
                              │
   Customer pays PIX ─────────┼─── Mercado Pago webhook ──▶ /api/public/webhooks/mercadopago
                              │                                       │
                              │                              webhook_events(received→validated)
                              │                              workflow.transition(authorized→captured→paid)
                              ▼                              payments.amount_captured += amount
                          OUTBOX: payment.captured, payment.paid
                              │
                              ▼
                       Order Engine consumes ──▶ order.paid
```

### 14.2 Refund

```text
[Operator] ──requestRefund──▶ payment_refunds(status=requested)
                                   │ OUTBOX: payment.refund.requested
[Approver] ──approveRefund──▶ payment_refunds(status=approved)
                                   │
[SF executeRefund] ──adapter.refund──▶ PSP
                                   │
                                   ▼
                            payment_refunds(status=completed)
                            payment_transactions(kind=partial_refund|refund)
                            payments.amount_refunded += amount
                            payments.status → partially_refunded | refunded
                            OUTBOX: payment.refunded
                                   │
                            Order Engine ──▶ order.refunded
```

### 14.3 Chargeback

```text
Webhook(topic=chargebacks) ─▶ payment_chargebacks(status=opened)
                                       │ OUTBOX: payment.chargeback.created
Operator uploads evidence ─▶ payment_documents(kind=chargeback_evidence)
                              payment_chargebacks(status=evidence_required→under_review)
PSP final decision (webhook) ─▶ won | lost
                              if lost: payment_transactions(kind=chargeback, direction=debit)
                                       payments.status='chargeback'
                              OUTBOX: payment.chargeback.{won|lost|closed}
```

---

## 15. Observability — Métricas

Materializadas em `mv_payment_metrics_daily` + expostas via Server Function `getPaymentMetrics`:

| Métrica | Fórmula |
|---|---|
| `approval_rate` | authorized / total_attempts(authorize) |
| `capture_rate` | captured / authorized |
| `refund_rate` | refunded_amount / captured_amount |
| `chargeback_rate` | chargebacks_count / paid_count |
| `gateway_latency_p50/p95/p99` | percentiles de `payment_attempts.latency_ms` |
| `gateway_errors` | count by `error_code` |
| `webhook_latency` | `processed_at - received_at` |
| `payment_duration` | `paid_at - created_at` |
| `retry_rate` | attempts > 1 / total_payments |

Exposição também no `metrics` (tabela existente) para o dashboard global.

---

## 16. Riscos

1. **Drift entre OMS e Payment Engine** — Mitigação: idempotência via `payable_type+payable_id` + reconciliação automática de invariantes (`amount_paid_orders == sum(payments.amount_captured - amount_refunded)`).
2. **Vazamento de PCI/PII** — Nunca persistir PAN, CVV, full card; apenas `last4`, `brand`, `bin`. Colunas sensíveis marcadas `is_secret/is_pii` com RLS estrita. Webhook bodies criptografados em rest se contiverem PII.
3. **Replay de webhook malicioso** — HMAC + `UNIQUE(external_event_id)` + timestamp drift máximo de 5 min.
4. **Race conditions em capture/refund** — `version` + optimistic locking; trigger `payments_balance_invariant`.
5. **Dependência de um único PSP** — Adapter pattern + `priority` em `payment_gateways` permite failover.
6. **Crescimento de tabelas append-only** — Particionamento por mês + política de retenção (raw_body em webhook após 12 meses).
7. **Inconsistência em settlement** — Reconciliação diária obrigatória; diffs viram tickets via `payment.reconciliation.divergent`.
8. **Backpressure no outbox** — DLQ já existente; alerta quando lag > N min.

---

## 17. Melhorias recomendadas

1. **Antifraude pluggable** — `FraudAdapter` opcional invocado antes de `authorize` (capability `pre_authorization_check`).
2. **Tokenização global** — `payment_method_tokens` table para card-on-file (cross-gateway via adapter tokens).
3. **3DS orchestration** — fluxo dedicado em workflow `payment.v1` com state `awaiting_3ds`.
4. **Smart routing** — política declarativa em `payment_gateways.routing_rules JSONB` (BIN, valor, método, país) para escolher o melhor PSP.
5. **PIX QR dinâmico com TTL** — job de expiração emite `payment.expired` e libera o pedido.
6. **Sandbox flag por gateway** — `is_sandbox BOOLEAN` para ambientes de teste sem mover schema.
7. **Sandbox de webhook** — UI de replay com diff antes/depois.
8. **Métricas em tempo real via Realtime** — subscribe em `payments` para o dashboard ops.

---

## 18. Entregáveis confirmados nesta auditoria

- [x] 1. Visão geral
- [x] 2. DER completo
- [x] 3. Todas as tabelas (com FKs, índices, constraints, triggers, RLS, RBAC)
- [x] 4. Fluxogramas (Checkout PIX, Refund, Chargeback, Webhook)
- [x] 5. Workflow `payment.v1`
- [x] 6. Server Functions previstas
- [x] 7. Domain Events
- [x] 8. RLS
- [x] 9. RBAC
- [x] 10. Performance
- [x] 11. Extensibilidade
- [x] 12. Riscos
- [x] 13. Melhorias recomendadas

---

## 19. Plano de migrations (proposto — para aprovação posterior)

| Migration | Conteúdo |
|---|---|
| **1/3** | Enums + tabelas core: `payment_gateways`, `payments`, `payment_attempts`, `payment_transactions`, `payment_events`, `payment_metadata`, `payment_allocations`. Triggers de invariante e outbox. RLS + GRANTs + RBAC permissions. |
| **2/3** | Refund/Chargeback/Docs/Notes/Reconciliation: `payment_refunds`, `payment_chargebacks`, `payment_documents`, `payment_notes`, `payment_reconciliation`. Workflow definition `payment.v1`. |
| **3/3** | Webhook Engine: `webhook_events` + rotas públicas + replay. Materialized views de métricas + jobs cron de reconciliação. |

---

**Aguardando aprovação para iniciar Migration 1/3.**
