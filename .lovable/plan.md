## Hardening Residual — Plano

Antes de aplicar, quero validar o escopo — em especial o item 2, porque a `.lovable/security-memory.md` já registra que `EXECUTE` de SECURITY DEFINER foi revogado de `PUBLIC`/`anon` deixando apenas `current_user_context` e `super_admin_exists`. Um `SELECT` direto no `pg_proc` mostra o contrário: **>90 funções `secdef` ainda estão executáveis por `anon`** (inclusive `payment_authorize`, `payment_capture`, `fulfillment_create`, `order_cancel`, `notification_enqueue`, `fiscal_set_credentials`, `decrypt_pii`, `encrypt_pii`, `handle_new_auth_user`, triggers `tg_*`, etc.).

Isso significa que a "correção" anterior não chegou a rodar em produção **ou** foi desfeita por migrations posteriores. É o achado mais grave do rescan e precisa de ação antes do E2E.

### 1. Guest cart — invalidar `session_token` ao converter/abandonar

Migration com trigger `BEFORE UPDATE OF status ON public.carts`:
- Se `NEW.status IN ('converted','abandoned')` e `OLD.status = 'active'` → `NEW.session_token := NULL`.
- Não toca `cart_items`, `cart_timeline`, `cart_snapshots`, `orders`.
- Escopo: apenas carts com `customer_id IS NULL` (retail anônimo). Carrinho autenticado/wholesale não usa token, mas o `NULL` no token é inofensivo pra eles.
- RPC `cart_accessible` (que consulta por token) passa a rejeitar automaticamente carts convertidos/abandonados sem alterar sua lógica.

### 2. Revogar EXECUTE de `anon` em SECURITY DEFINER

Classificação com base no uso real (grepping em `services/*.server.ts` + RLS policies):

**Manter para anon (fluxo guest/bootstrap, chamados via RLS ou RPC pública):**
- `current_user_context`, `super_admin_exists` — bootstrap.
- `cart_accessible`, `cart_set_session_v1` — carrinho guest.
- `coupon_lookup_by_code_v1` — cupom no checkout guest.
- `public_tracking_resolve` — rastreio público via token.
- `is_approved_wholesale_customer`, `current_customer_id`, `_is_customer_owner`, `payment_store_id` — helpers referenciados dentro de RLS policies (não são chamados via PostgREST, mas `authenticated` executa quando a policy dispara; anon precisa executar quando a mesma policy avalia em requests anônimos legítimos — verificar caso a caso, revogar quando policy não roda para anon).
- Triggers `handle_new_auth_user`, `handle_new_storefront_user`, `customers_self_update_guard`, `wholesale_apps_self_update_guard`, `_apply_support_sla_dates`, todos `tg_*_outbox`, `_support_event_to_outbox`, `_order_admin_log`, `_seed_payment_transition`, `_recompute_notification_status`, `orders_snapshot_sales_channel` — **funções de trigger nunca são invocadas por PostgREST**, então `REVOKE ... FROM anon` é seguro; o trigger roda no dono. Vou revogar de `anon` e de `authenticated` (defesa em profundidade).

**Revogar de anon (nenhum fluxo público chama):**
- Toda a família `payment_*` (authorize, capture, cancel, fail, refund_*, chargeback_*, reconciliation_*, record_*, set_credentials, set_webhook_secret, webhook_ingest, webhook_mark_*).
- Toda a família `fulfillment_*`, `pick_list_*`, `package_*`, `shipment_*`, `delivery_attempt_register`, `tracking_event_ingest`, `shipping_*`.
- Toda a família `order_*` (add_note, add_tag, assign_user, cancel, persist_shipping_snapshot, remove_tag).
- `fiscal_*` (record_*, set_credentials, set_webhook_secret, update_status, webhook_ingest, webhook_mark_processed).
- `notification_*` (enqueue, dispatch_worker, consume_outbox_event, mark_*).
- `support_*` (ticket_*, sla_*, recompute_sla_states).
- `encrypt_pii`, `decrypt_pii`, `_assert_fulfillment_permission`, `_pick_warehouse_for_variant`, `consume_stock_reservations_for_order`, `release_stock_reservation`, `reserve_stock_for_cart_item`, `seed_payment_workflow`, `customer_dashboard_refresh`, `customer_timeline_refresh`, `portal_cache_invalidate`, `portal_refresh_metrics`, `payments_apply_refund_total`, `_resolve_support_sla_policy`.

Manter EXECUTE para `authenticated` — todas essas são chamadas via RPC/service pelo painel admin com sessão autenticada. A migration é apenas `REVOKE ... FROM anon` (e `FROM PUBLIC` onde ainda houver).

Também `REVOKE EXECUTE ON FUNCTION emit_domain_event(...) FROM anon, PUBLIC` — chamada apenas pelo próprio backend.

Atualizar `.lovable/security-memory.md` para refletir a lista real de funções expostas a `anon` (allowlist explícita).

### 3. Auditoria `/api/public/*`

Rotas existentes:
- `melhor-envio-callback.ts` — OAuth callback
- `melhor-envio-webhook.ts` — webhook Melhor Envio
- `mercadopago.ts` — webhook MercadoPago
- `nuvemfiscal.ts` — webhook Nuvem Fiscal
- `shipping-tracking-sync.ts` — cron

Vou ler cada handler e produzir a tabela pedida (método, assinatura verificada?, valida payload?, usa supabaseAdmin?, retorna PII?, status HTTP, risco). Correções só se encontrar problema real — sem reescrever handlers que já verificam HMAC + Zod.

### 4. Validar wholesale cookie

Sem migration — apenas leitura de `sales-channel.ts`, `sales-channel-provider.tsx`, `storefront.functions.ts` e RLS de `price_lists`/`cart_items` para confirmar que:
1. Preço wholesale só é resolvido server-side após `has_permission('wholesale.buy', store_id)` **ou** `is_approved_wholesale_customer(auth.uid())`.
2. Criação de cart com `sales_channel='wholesale'` passa pela mesma checagem.
3. Cookie/localStorage só afeta UI, nunca o preço final ou o snapshot do order.

Se algum ponto usar apenas o valor do cookie sem revalidação server-side, corrijo. Se estiver ok, entrego a evidência (arquivos + linhas).

### Entrega

Um único relatório em Markdown na resposta com:
1. Trigger aplicada (SQL);
2. Funções revogadas + lista mantida com justificativa;
3. Tabela de `/api/public/*`;
4. Resultado wholesale (ok ou correção);
5. Riscos residuais;
6. Confirmação de que nenhuma tabela de produto/preço/estoque/pedido/imagem foi alterada.

Depois disso executo o E2E via Playwright (retail guest → converter, wholesale aprovado, wholesale negado, duplo clique checkout, refresh checkout, pedido público, cart convertido re-uso de token, navbar/filtros).

### Arquivos afetados
- 1 migration (trigger + REVOKEs em ~80 funções). Sem `CREATE TABLE`, sem alteração de dados, sem alteração de RLS existente.
- `.lovable/security-memory.md` (atualizar allowlist real).
- Possivelmente 1 arquivo em `src/lib/business/` **se** a auditoria wholesale/públicos encontrar bug — caso contrário só relatório.

### Fora de escopo
- Não altero produtos, preços, imagens, RLS de negócio, painel admin, rotas de UI.
- Não movo extensions em `public`.
- Não mexo em RPCs listados como architecture-driven na `security-memory.md` (has_role, has_permission, cart_recalculate, idempotency_*, outbox_*, etc.).

Aprova para eu abrir a migration?
