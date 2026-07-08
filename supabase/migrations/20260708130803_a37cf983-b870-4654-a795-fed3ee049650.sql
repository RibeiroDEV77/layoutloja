
-- ============================================================================
-- Fase 2B.1 — Schema & constraints for atomic stock/order model
-- No data mutation. No touch on quantity_on_hand / quantity_reserved.
-- Preflight validated: no violations, no duplicate active cart_item_id.
-- ============================================================================

-- 1) stock_reservations: warehouse_id required for terminal-safe states.
--    reservation_status enum = (active, released, consumed, expired).
--    Active/consumed reservations MUST have a warehouse; released/expired MAY be null (historical).
ALTER TABLE public.stock_reservations
  ADD CONSTRAINT stock_reservations_warehouse_required_ck
  CHECK (status IN ('released','expired') OR warehouse_id IS NOT NULL)
  NOT VALID;

ALTER TABLE public.stock_reservations
  VALIDATE CONSTRAINT stock_reservations_warehouse_required_ck;

-- 2) stock_levels: physical integrity.
ALTER TABLE public.stock_levels
  ADD CONSTRAINT stock_levels_on_hand_nonneg_ck CHECK (quantity_on_hand >= 0) NOT VALID;
ALTER TABLE public.stock_levels
  ADD CONSTRAINT stock_levels_reserved_nonneg_ck CHECK (quantity_reserved >= 0) NOT VALID;
ALTER TABLE public.stock_levels
  ADD CONSTRAINT stock_levels_reserved_le_on_hand_ck CHECK (quantity_reserved <= quantity_on_hand) NOT VALID;

ALTER TABLE public.stock_levels VALIDATE CONSTRAINT stock_levels_on_hand_nonneg_ck;
ALTER TABLE public.stock_levels VALIDATE CONSTRAINT stock_levels_reserved_nonneg_ck;
ALTER TABLE public.stock_levels VALIDATE CONSTRAINT stock_levels_reserved_le_on_hand_ck;

-- 3) stock_reservations.qty > 0 already exists as stock_reservations_qty_check. Skipped.

-- 4) Partial unique index: only one active reservation per cart_item_id.
CREATE UNIQUE INDEX IF NOT EXISTS stock_reservations_active_cart_item_uidx
  ON public.stock_reservations (cart_item_id)
  WHERE status = 'active' AND cart_item_id IS NOT NULL;

-- 5) orders: stock_released_at (idempotency_key + source_cart_id already exist).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_released_at timestamptz;

-- 6) orders: prevent two active orders from same cart.
--    order_status enum has 'cancelled'. Active = not cancelled.
CREATE UNIQUE INDEX IF NOT EXISTS orders_active_source_cart_uidx
  ON public.orders (store_id, source_cart_id)
  WHERE source_cart_id IS NOT NULL AND status <> 'cancelled';

-- 7) orders: idempotency key uniqueness per store (prevents duplicate order from double-click).
CREATE UNIQUE INDEX IF NOT EXISTS orders_store_idempotency_key_uidx
  ON public.orders (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
