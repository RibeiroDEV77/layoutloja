# ADR-0001 — Workflow Engine como governante de estados

- **Status:** Aceito
- **Data:** 2026-06-21
- **Escopo:** Plataforma (todos os agregados com ciclo de vida — order, cart, fulfillment, return, purchase_order, inventory_count, stock_transfer)

## Contexto
Múltiplos agregados de negócio possuem estados com transições governadas por regras (guards, side-effects, permissões). Implementar máquinas de estado ad-hoc dentro de cada service produziria duplicação, regressões silenciosas e falta de auditabilidade.

## Decisão
Adotar um **Workflow Engine** baseado em tabelas declarativas (`workflow_definitions`, `workflow_states`, `workflow_transitions`, `workflow_instances`, `workflow_state_history`). Toda transição de status de um agregado **deve** ocorrer via engine, com:
- `guard` declarativo (SQL/TS) que valida pré-condições;
- `side_effect` opcional (server function) executada pós-transição;
- `required_permission` checada antes da transição;
- registro automático em `workflow_state_history` + emissão de evento no Outbox.

## Alternativas consideradas
1. Máquinas de estado em código por agregado → rejeitado por duplicação e ausência de auditoria uniforme.
2. Biblioteca externa (XState) no client → rejeitado por mover decisão crítica para fora do servidor.
3. Triggers Postgres puros → rejeitado por dificultar testes e observabilidade.

## Consequências
- ✅ Auditoria uniforme de transições.
- ✅ Workflows customizáveis por loja sem deploy.
- ✅ Reuso entre Cart, Order, Returns, Purchases.
- ⚠️ Curva de aprendizado: developers devem evitar atualizar status diretamente.
- ⚠️ Workflows mal modelados podem bloquear operação — exige simulação/dry-run obrigatório.

## Invariantes
- Nenhum service pode escrever em `orders.status` (ou equivalente) sem passar pelo engine.
- Toda transição gera linha em `workflow_state_history` E em `order_timeline` (ou equivalente do agregado).
