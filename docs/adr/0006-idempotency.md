# ADR-0006 — Idempotency Keys obrigatórias em mutações críticas

- **Status:** Aceito
- **Data:** 2026-06-21
- **Escopo:** Plataforma — toda Server Function que produz efeito não-reversível

## Contexto
Cliente clica duas vezes em "Finalizar pedido". Webhook do gateway é reentregue. Worker do outbox processa o mesmo evento após timeout. Em todos os casos, sem idempotência, o sistema duplica pedido, cobra duas vezes ou envia duas etiquetas.

## Decisão
Adotar a infraestrutura `idempotency_keys` + RPCs `idempotency_begin` e `idempotency_complete`:
- Toda Server Function classificada como **mutação crítica** declara um **scope** (ex.: `order.place`) e recebe **key** do chamador.
- `idempotency_begin(scope, key, store, actor, request_hash, ttl)` retorna:
  - `proceed` (nova execução), `replay` (resposta cacheada), `in_progress` (outra execução em curso), `retry` (falhou antes), `conflict` (mesmo key, payload diferente).
- `idempotency_complete` persiste status final + resposta para replay.

Scopes definidos por agregado (ver ADR-0005 §invariantes e documentos de fase).

## Alternativas consideradas
1. Idempotência apenas em gateways de pagamento → rejeitado: insuficiente para fulfillment, returns, cancelations.
2. Idempotência via unique constraint pontual → rejeitado: não cobre replay de resposta.

## Consequências
- ✅ Webhooks e clientes podem reentregar sem efeitos colaterais.
- ✅ Replay de resposta consistente.
- ⚠️ Chamadores devem gerar keys estáveis e determinísticas (UUID v4 por intenção, não por click).
- ⚠️ TTL precisa ser dimensionado por scope (curto p/ checkout, longo p/ fiscal).

## Invariantes
- Toda Server Function que cria pedido, payment, refund, fulfillment, shipment, return, cancel, hold ou edit usa idempotency.
- Webhook handlers públicos (`/api/public/webhooks/*`) usam idempotency baseada no event_id do provider.
