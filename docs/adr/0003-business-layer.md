# ADR-0003 — Business Layer como única fonte de domínio

- **Status:** Aceito
- **Data:** 2026-06-21
- **Escopo:** Plataforma (todos os módulos de negócio)

## Contexto
Em projetos de e-commerce típicos, regras de negócio acabam espalhadas entre componentes React, hooks, edge functions e triggers SQL. Isso produz divergência (mesma regra implementada em múltiplos lugares), bugs por desincronização e impossibilidade de auditar invariantes.

## Decisão
Concentrar **todas as regras de domínio** em uma camada explícita organizada em três níveis:

1. **`src/lib/business/services/*.server.ts`** — services de domínio puros (pricing, stock, cart, order, etc.). Manipulam repositories e RPCs. **Server-only** (extensão `.server.ts` bloqueia bundle client).
2. **`src/lib/business/repositories/*`** — acesso encapsulado ao Postgres. Nenhum service constrói SQL fora daqui.
3. **`src/lib/business/*.functions.ts`** — Server Functions (`createServerFn`) que expõem services à UI com `requireSupabaseAuth`, idempotency e validação Zod.

Regras absolutas:
- UI **nunca** consulta tabelas de domínio diretamente.
- UI **nunca** importa de `*.server.ts`.
- Edge Functions Supabase **não** são usadas para lógica interna (apenas webhooks externos que precisam viver no domínio Supabase).
- Lógica não-trivial não vive em triggers — triggers fazem **validação de invariantes** e **manutenção** (timestamps, audit), nunca regra de negócio.

## Alternativas consideradas
1. Lógica em hooks React → rejeitado: roda no client, sem garantia de execução.
2. Lógica em Edge Functions → rejeitado: latência, duplicação com TanStack server functions, sem reuso server-side em loaders.
3. Stored procedures puras → rejeitado: difícil testar, sem reaproveitar lógica TS, sem tipagem.

## Consequências
- ✅ Single source of truth de regras.
- ✅ Refatoração e teste fáceis (services são funções puras testáveis).
- ✅ UI desacoplada e substituível.
- ⚠️ Disciplina necessária — review obrigatória de qualquer `.from('...')` em rota.
- ⚠️ Testes arquiteturais (em `tests/architecture/`) impedem regressão.

## Invariantes (verificados por teste)
- Nenhum arquivo em `src/routes/**` contém `supabase.from(` para tabelas de domínio.
- Nenhum `.functions.ts` importa `client.server` em escopo de módulo (só dentro do handler via `await import`).
- Toda Server Function que muta dados de usuário usa `.middleware([requireSupabaseAuth])`.
