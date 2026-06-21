# ADR-0002 — Transactional Outbox para eventos de domínio

- **Status:** Aceito
- **Data:** 2026-06-21
- **Escopo:** Plataforma

## Contexto
Eventos de domínio (`order.created`, `payment.captured`, etc.) precisam ser entregues a consumidores internos (workers, analytics) e externos (webhooks, ERP). Publicação direta dentro da transação acopla domínio a infraestrutura e cria janelas de inconsistência (commit no banco + falha no broker = evento perdido).

## Decisão
Implementar o padrão **Transactional Outbox**:
- Toda emissão de evento grava em `event_outbox` **dentro da mesma transação** da mutação de domínio (RPC `enqueue_outbox_event`).
- Workers consomem via `claim_outbox_batch` (lock + skip locked), publicam, marcam como `published` ou `failed`.
- Falhas são retentadas com backoff exponencial; após `max_attempts` movem para `event_outbox_dead_letter`.
- `correlation_id` e `causation_id` propagam contexto entre eventos relacionados.

## Alternativas consideradas
1. Publicar direto no broker → rejeitado: dual-write inconsistency.
2. CDC (Debezium/logical replication) → rejeitado nesta fase: complexidade operacional + custo.
3. Trigger Postgres `NOTIFY` → rejeitado: sem persistência de retry e dead-letter.

## Consequências
- ✅ At-least-once garantido com consistência transacional.
- ✅ Auditoria completa de tentativas e falhas.
- ✅ Consumidores podem ser adicionados sem alterar produtores.
- ⚠️ Latência adicional (poll do worker) — aceitável para o domínio.
- ⚠️ Consumidores **devem ser idempotentes** (at-least-once, não exactly-once).

## Invariantes
- Nenhum service emite evento de domínio fora do Outbox.
- Toda mutação que muda estado de agregado emite ao menos um evento.
- Consumidores externos assinam via `domain_event_subscriptions`; o agregado não conhece consumidores.
