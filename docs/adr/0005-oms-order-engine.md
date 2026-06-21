# ADR-0005 — OMS-first Order Engine (não CRUD)

- **Status:** Aceito
- **Data:** 2026-06-21
- **Escopo:** Fase 5.3 (Order Engine v1.1)
- **Referência:** `Fase_5_3_Order_Engine_Arquitetura.md` + `Fase_5_3_Delta_Refinamentos.md`

## Contexto
A maioria das plataformas trata pedido como CRUD: uma tabela `orders`, status como string, items em outra tabela, e tudo o mais é "feature em cima". Isso colapsa sob a operação real: split shipment, multi-payment, holds, returns, SLA, marketplace, fiscal — viram retrabalhos sucessivos.

## Decisão
Modelar o pedido como **Order Management System completo desde o dia 1**, com:
- **Agregado central** (`orders`) com versionamento otimista e referência ao Workflow.
- **Snapshots imutáveis** em pontos-chave (placed, paid, fulfillment_ready, shipped, delivered, edited).
- **Timeline append-only** (`order_timeline`) — fonte da verdade operacional.
- **Ledger append-only** (`order_ledger`) — fonte da verdade financeira.
- **Engines de primeira classe:** Hold Engine, Split Order, Payment Allocation, Lock Manager, Order Score, Order Rule Engine.
- **Documentos via DAM** com templates versionados e entrega multicanal rastreada.
- **Workflow** com 17 estados, guards, side-effects e bloqueios por holds.
- **Search Index denormalizado** com busca por SKU, barcode, CPF/CNPJ, telefone/WhatsApp, CEP, NF, tracking.
- **Métricas horárias + diárias** (rollup hierárquico).

Princípios de fronteira:
- Order Engine **não calcula** preço/frete/imposto — consome snapshots.
- Order Engine **não move estoque** — consome `stock_reservations` e dispara `stock_movements` via Reservation Service.
- Order Engine **não emite NF** — emite `order.fiscal_required` para adapter futuro.

## Alternativas consideradas
1. Começar como CRUD e evoluir → rejeitado: dívida técnica garantida, migração futura quebra integrações.
2. Adotar OMS de terceiros (Manhattan, Linx) → rejeitado nesta fase: custo, lock-in, integração lenta com plataforma própria.

## Consequências
- ✅ Pedido auditável e reproduzível anos depois.
- ✅ Pronto para marketplace, multi-CD, fiscal e ERP sem schema breaking.
- ✅ Operação real (split shipment, multi-payment, hold, return) coberta nativamente.
- ⚠️ Schema maior (~40 tabelas) — exige disciplina de migration e testes de invariante.
- ⚠️ Curva inicial maior — compensada pela ausência de retrabalho.

## Invariantes
- `order_timeline` e `order_ledger` só permitem INSERT (trigger bloqueia UPDATE/DELETE).
- Toda mutação relevante grava timeline + emite outbox.
- Captura de pagamento é a única operação que consome `stock_reservations` definitivamente.
- Cancel pós-`shipped` é proibido — forçar fluxo Return.
- Soma de allocations por payment = payment.amount.
- Refund total ≤ Σ(captures) − Σ(refunds_existentes).
