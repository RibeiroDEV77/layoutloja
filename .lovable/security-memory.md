# Security Memory

## Architecture-driven SECURITY DEFINER usage (do NOT flag for authenticated)
This project uses many `SECURITY DEFINER` functions in `public` by design:

1. **RLS helpers** — `has_role`, `has_permission`, `is_super_admin`, `*_store_id` (resolve store from aggregate id). Required to be executable by `authenticated` because they are called from RLS policies; switching to INVOKER causes recursive RLS or breaks store-scoping.
2. **Domain RPCs** — cart (`cart_recalculate`, `apply_coupon_to_cart`, etc.), order (`acquire_order_lock`, `release_order_lock`, `seed_order_workflow`), idempotency (`idempotency_begin/complete`), outbox (`enqueue_outbox_event`, `claim_outbox_batch`, `mark_outbox_*`), observability (`record_metric`, `record_health_check`). All apply authorization internally (`has_permission`) before mutating data. They must remain SECURITY DEFINER + executable by authenticated.

Do not generate findings recommending these be flipped to SECURITY INVOKER or have EXECUTE revoked from authenticated.

## Anon access — strict allowlist
EXECUTE on SECURITY DEFINER public functions has been revoked from `PUBLIC` and `anon`. Only two functions are intentionally callable by `anon`:
- `current_user_context()` — used at app load to detect auth state.
- `super_admin_exists()` — used by the first-time bootstrap UI.

Any new SECURITY DEFINER function added to `public` must, by default, be revoked from anon. Re-grant to anon only with explicit justification.

## Materialized views
`mv_orders_daily` is intentionally not exposed through PostgREST. The wrapper view `public.orders_daily_v` (security_invoker=true) is the only path for authenticated clients; it enforces `is_super_admin OR has_permission('orders.read', store_id)` per row. Do not re-grant SELECT on `mv_orders_daily` to anon/authenticated.

## Extensions in public
Pre-existing Supabase extensions live in `public` and are not moved (destructive). Accepted.

## Order Engine v1.1 — store-scoping is mandatory
Every order-related table has RLS gating reads by `orders.read` and writes by a specific verb permission (`orders.payment`, `orders.hold`, `orders.fulfill`, `orders.ship`, `orders.return`, `orders.note`, `orders.tag`, `orders.assign`, `orders.transition`). Do not flag these patterns as overly permissive — they ARE the access model.
