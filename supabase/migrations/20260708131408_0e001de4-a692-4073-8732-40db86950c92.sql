
-- ============================================================================
-- Fase 2B.2 — Atomic stock/reservation/order RPCs
-- All functions run in a transaction; every stock_levels row touched is
-- locked with SELECT ... FOR UPDATE before UPDATE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: pick_warehouse_for_variant
-- Returns the warehouse_id with the highest availability for a variant/store.
-- Deterministic tie-breaker via warehouse_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pick_warehouse_for_variant(
  _store_id uuid, _variant_id uuid
) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sl.warehouse_id
    FROM public.stock_levels sl
   WHERE sl.store_id = _store_id AND sl.variant_id = _variant_id
   ORDER BY (sl.quantity_on_hand - sl.quantity_reserved) DESC, sl.warehouse_id ASC
   LIMIT 1
$$;

-- ============================================================================
-- 1. reserve_stock_for_cart_item — atomic, idempotent by cart_item_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reserve_stock_for_cart_item(
  _cart_item_id uuid, _ttl_seconds integer DEFAULT 1800
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_item public.cart_items%ROWTYPE;
  v_cart public.carts%ROWTYPE;
  v_existing public.stock_reservations%ROWTYPE;
  v_warehouse uuid;
  v_level_id uuid;
  v_on_hand int;
  v_reserved int;
  v_delta int;
  v_res_id uuid;
BEGIN
  SELECT * INTO v_item FROM public.cart_items WHERE id = _cart_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cart item % not found', _cart_item_id USING ERRCODE='P0002'; END IF;
  IF v_item.qty <= 0 THEN RAISE EXCEPTION 'qty must be > 0' USING ERRCODE='22000'; END IF;

  SELECT * INTO v_cart FROM public.carts WHERE id = v_item.cart_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cart % not found', v_item.cart_id USING ERRCODE='P0002'; END IF;
  IF v_cart.status <> 'active' THEN
    RAISE EXCEPTION 'Cart % not active (status=%)', v_cart.id, v_cart.status USING ERRCODE='22000';
  END IF;

  -- Existing active reservation for this cart_item (unique index guarantees at most one)
  SELECT * INTO v_existing FROM public.stock_reservations
   WHERE cart_item_id = _cart_item_id AND status = 'active'
   LIMIT 1;

  IF FOUND THEN
    v_warehouse := v_existing.warehouse_id;
  ELSE
    v_warehouse := public._pick_warehouse_for_variant(v_cart.store_id, v_item.variant_id);
    IF v_warehouse IS NULL THEN
      RAISE EXCEPTION 'No stock level for variant %', v_item.variant_id USING ERRCODE='22000';
    END IF;
  END IF;

  -- Lock the stock_level row
  SELECT id, quantity_on_hand, quantity_reserved
    INTO v_level_id, v_on_hand, v_reserved
    FROM public.stock_levels
   WHERE store_id = v_cart.store_id AND warehouse_id = v_warehouse AND variant_id = v_item.variant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock level not found for variant % in warehouse %', v_item.variant_id, v_warehouse USING ERRCODE='P0002';
  END IF;

  v_delta := v_item.qty - COALESCE(v_existing.qty, 0);

  IF v_delta > 0 THEN
    IF (v_on_hand - v_reserved) < v_delta THEN
      RAISE EXCEPTION 'Insufficient stock (available=%, requested_delta=%)', (v_on_hand - v_reserved), v_delta USING ERRCODE='22000';
    END IF;
    UPDATE public.stock_levels
       SET quantity_reserved = quantity_reserved + v_delta,
           last_movement_at = now()
     WHERE id = v_level_id;
  ELSIF v_delta < 0 THEN
    UPDATE public.stock_levels
       SET quantity_reserved = GREATEST(0, quantity_reserved + v_delta),
           last_movement_at = now()
     WHERE id = v_level_id;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.stock_reservations
       SET qty = v_item.qty,
           expires_at = now() + make_interval(secs => _ttl_seconds),
           updated_at = now()
     WHERE id = v_existing.id;
    v_res_id := v_existing.id;
  ELSE
    INSERT INTO public.stock_reservations(
      store_id, cart_id, cart_item_id, variant_id, warehouse_id, qty, status, expires_at
    ) VALUES (
      v_cart.store_id, v_cart.id, v_item.id, v_item.variant_id, v_warehouse, v_item.qty,
      'active', now() + make_interval(secs => _ttl_seconds)
    ) RETURNING id INTO v_res_id;
  END IF;

  INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, actor_user_id, reason, metadata)
  VALUES (
    v_res_id, v_cart.store_id,
    CASE WHEN v_delta >= 0 THEN 'reserve'::reservation_ledger_kind ELSE 'release'::reservation_ledger_kind END,
    ABS(v_delta), auth.uid(),
    CASE WHEN v_delta = 0 THEN 'noop' WHEN v_delta > 0 THEN 'reserve_delta' ELSE 'release_delta' END,
    jsonb_build_object('cart_item_id', _cart_item_id, 'delta', v_delta, 'new_qty', v_item.qty)
  );

  PERFORM public.record_cart_timeline_event(v_cart.id, 'reservation_upserted',
    jsonb_build_object('reservation_id', v_res_id, 'variant_id', v_item.variant_id, 'qty', v_item.qty, 'delta', v_delta));

  RETURN v_res_id;
END $function$;

-- ============================================================================
-- 2. release_stock_reservation — idempotent
-- ============================================================================
CREATE OR REPLACE FUNCTION public.release_stock_reservation(
  _reservation_id uuid, _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_res public.stock_reservations%ROWTYPE;
  v_level_id uuid;
BEGIN
  SELECT * INTO v_res FROM public.stock_reservations WHERE id = _reservation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_res.status <> 'active' THEN RETURN; END IF;

  IF v_res.warehouse_id IS NOT NULL THEN
    SELECT id INTO v_level_id FROM public.stock_levels
     WHERE store_id = v_res.store_id AND warehouse_id = v_res.warehouse_id AND variant_id = v_res.variant_id
     FOR UPDATE;
    IF FOUND THEN
      UPDATE public.stock_levels
         SET quantity_reserved = GREATEST(0, quantity_reserved - v_res.qty),
             last_movement_at = now()
       WHERE id = v_level_id;
    END IF;
  END IF;

  UPDATE public.stock_reservations
     SET status='released', released_at=now(), updated_at=now()
   WHERE id = _reservation_id;

  INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, actor_user_id, reason)
  VALUES (_reservation_id, v_res.store_id, 'release', v_res.qty, auth.uid(), COALESCE(_reason,'manual_release'));

  IF v_res.cart_id IS NOT NULL THEN
    PERFORM public.record_cart_timeline_event(v_res.cart_id, 'reservation_released',
      jsonb_build_object('reservation_id', _reservation_id, 'reason', _reason));
  END IF;
END $function$;

-- ============================================================================
-- 3. expire_stale_cart_reservations — same lock discipline as release
-- ============================================================================
CREATE OR REPLACE FUNCTION public.expire_stale_cart_reservations()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_count int := 0;
  r public.stock_reservations%ROWTYPE;
  v_level_id uuid;
BEGIN
  FOR r IN
    SELECT * FROM public.stock_reservations
     WHERE status='active' AND expires_at < now()
     ORDER BY expires_at ASC
     LIMIT 500
     FOR UPDATE SKIP LOCKED
  LOOP
    IF r.warehouse_id IS NOT NULL THEN
      SELECT id INTO v_level_id FROM public.stock_levels
       WHERE store_id=r.store_id AND warehouse_id=r.warehouse_id AND variant_id=r.variant_id
       FOR UPDATE;
      IF FOUND THEN
        UPDATE public.stock_levels
           SET quantity_reserved = GREATEST(0, quantity_reserved - r.qty),
               last_movement_at = now()
         WHERE id = v_level_id;
      END IF;
    END IF;

    UPDATE public.stock_reservations
       SET status='expired', released_at=now(), updated_at=now()
     WHERE id = r.id;

    INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, reason)
    VALUES (r.id, r.store_id, 'expire', r.qty, 'ttl');

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $function$;

-- ============================================================================
-- 4. consume_stock_reservations_for_order (new helper)
--    For each cart_item, locks stock_level, reserves if needed, then consumes:
--    quantity_on_hand -= qty, quantity_reserved -= (reserved portion)
--    Writes stock_movements (movement_type='sale_out') and marks reservation consumed.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consume_stock_reservations_for_order(
  _order_id uuid, _cart_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_store uuid;
  ci record;
  v_res public.stock_reservations%ROWTYPE;
  v_warehouse uuid;
  v_level_id uuid;
  v_on_hand int;
  v_reserved int;
  v_reserved_portion int;
BEGIN
  SELECT store_id INTO v_store FROM public.orders WHERE id = _order_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Order % not found', _order_id USING ERRCODE='P0002'; END IF;

  FOR ci IN
    SELECT id, variant_id, qty FROM public.cart_items WHERE cart_id = _cart_id ORDER BY id
  LOOP
    IF ci.qty <= 0 THEN CONTINUE; END IF;

    -- Find active reservation (may be expired-but-still-active status; treat any active as reservation)
    SELECT * INTO v_res FROM public.stock_reservations
     WHERE cart_item_id = ci.id AND status = 'active'
     FOR UPDATE;

    IF FOUND THEN
      v_warehouse := v_res.warehouse_id;
      v_reserved_portion := v_res.qty;
    ELSE
      v_warehouse := public._pick_warehouse_for_variant(v_store, ci.variant_id);
      IF v_warehouse IS NULL THEN
        RAISE EXCEPTION 'No stock level for variant %', ci.variant_id USING ERRCODE='22000';
      END IF;
      v_reserved_portion := 0;
    END IF;

    SELECT id, quantity_on_hand, quantity_reserved
      INTO v_level_id, v_on_hand, v_reserved
      FROM public.stock_levels
     WHERE store_id=v_store AND warehouse_id=v_warehouse AND variant_id=ci.variant_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock level missing for variant % / warehouse %', ci.variant_id, v_warehouse USING ERRCODE='P0002';
    END IF;

    -- Available for consumption = on_hand - reserved (by others) + own reservation portion
    IF (v_on_hand - v_reserved + v_reserved_portion) < ci.qty THEN
      RAISE EXCEPTION 'Insufficient stock at consumption (variant=%, available=%, requested=%)',
        ci.variant_id, (v_on_hand - v_reserved + v_reserved_portion), ci.qty USING ERRCODE='22000';
    END IF;

    UPDATE public.stock_levels
       SET quantity_on_hand   = quantity_on_hand - ci.qty,
           quantity_reserved  = GREATEST(0, quantity_reserved - LEAST(v_reserved_portion, ci.qty)),
           last_movement_at   = now()
     WHERE id = v_level_id;

    IF v_res.id IS NOT NULL THEN
      UPDATE public.stock_reservations
         SET status='consumed', consumed_at=now(), order_id=_order_id, updated_at=now()
       WHERE id = v_res.id;

      INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, reason, metadata)
      VALUES (v_res.id, v_store, 'consume', ci.qty, 'order_create', jsonb_build_object('order_id', _order_id));
    END IF;

    INSERT INTO public.stock_movements(
      store_id, warehouse_id, variant_id, movement_type, quantity,
      reference_type, reference_id, notes, occurred_at
    ) VALUES (
      v_store, v_warehouse, ci.variant_id, 'sale_out', -ci.qty,
      'order', _order_id, 'Order placement consumption', now()
    );
  END LOOP;
END $function$;

-- ============================================================================
-- 5. order_create_from_cart — with idempotency_key + atomic stock consumption
-- ============================================================================
CREATE OR REPLACE FUNCTION public.order_create_from_cart(
  _cart_id uuid, _email text, _name text, _phone text, _address jsonb,
  _idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_cart           public.carts%ROWTYPE;
  v_quote          public.shipping_quotes%ROWTYPE;
  v_customer_id    uuid;
  v_order_id       uuid;
  v_order_number   text;
  v_fulfillment_id uuid;
  v_total_weight   numeric := 0;
  v_store_settings jsonb;
  v_origin_postal  text;
  v_existing_order uuid;
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN RAISE EXCEPTION 'Informe um e-mail para o pedido'; END IF;
  IF _name  IS NULL OR length(trim(_name))  = 0 THEN RAISE EXCEPTION 'Informe seu nome'; END IF;
  IF _address IS NULL OR coalesce(_address->>'postal_code','') = '' THEN
    RAISE EXCEPTION 'Endereço de entrega obrigatório';
  END IF;

  -- Lock cart FIRST to serialize concurrent checkouts on the same cart
  SELECT * INTO v_cart FROM public.carts WHERE id = _cart_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carrinho não encontrado' USING ERRCODE='P0002'; END IF;

  -- Idempotency by (store_id, idempotency_key)
  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_order
      FROM public.orders
     WHERE store_id = v_cart.store_id AND idempotency_key = _idempotency_key
     LIMIT 1;
    IF v_existing_order IS NOT NULL THEN RETURN v_existing_order; END IF;
  END IF;

  -- If cart already converted, return existing order for same source_cart_id
  IF v_cart.status = 'converted' THEN
    SELECT id INTO v_existing_order FROM public.orders
     WHERE store_id = v_cart.store_id AND source_cart_id = _cart_id AND status <> 'cancelled'
     ORDER BY placed_at DESC NULLS LAST LIMIT 1;
    IF v_existing_order IS NOT NULL THEN RETURN v_existing_order; END IF;
    RAISE EXCEPTION 'Carrinho já convertido';
  END IF;

  IF v_cart.status <> 'active' THEN
    RAISE EXCEPTION 'Carrinho não está ativo (status=%)', v_cart.status;
  END IF;
  IF (SELECT count(*) FROM public.cart_items WHERE cart_id = _cart_id) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  SELECT * INTO v_quote FROM public.shipping_quotes
   WHERE cart_id = _cart_id AND selected = true ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione uma modalidade de frete antes de finalizar'; END IF;

  SELECT id INTO v_customer_id FROM public.customers
   WHERE store_id = v_cart.store_id AND lower(email) = lower(_email) LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers(store_id, type, name, email, phone, status)
    VALUES (v_cart.store_id, 'pf', _name, _email, _phone, 'active')
    RETURNING id INTO v_customer_id;
  END IF;

  v_order_number := 'PED-' || to_char(now() AT TIME ZONE 'UTC','YYYYMMDD')
                 || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);

  INSERT INTO public.orders(
    store_id, order_number, status, channel, source_cart_id, customer_id,
    customer_email, customer_phone, currency,
    subtotal, discount_total, shipping_total, tax_total, fees_total, total,
    items_count, placed_at, metadata, idempotency_key
  ) VALUES (
    v_cart.store_id, v_order_number, 'pending_payment', 'storefront', _cart_id, v_customer_id,
    _email, _phone, v_cart.currency,
    v_cart.subtotal, v_cart.discount_total, v_cart.shipping_total, v_cart.tax_total, 0, v_cart.total,
    v_cart.items_count, now(),
    jsonb_build_object('source','storefront_checkout'), _idempotency_key
  ) RETURNING id INTO v_order_id;

  -- Consume stock (atomic, locked) BEFORE writing dependents
  PERFORM public.consume_stock_reservations_for_order(v_order_id, _cart_id);

  INSERT INTO public.order_items(
    order_id, store_id, item_type, product_id, variant_id, sku, name,
    qty, list_price, unit_price, discount_amount, tax_amount, line_total, snapshot, metadata
  )
  SELECT v_order_id, v_cart.store_id, 'physical'::order_item_type,
         ci.product_id, ci.variant_id,
         (ci.snapshot->>'sku'),
         COALESCE(ci.snapshot->>'product_name','Item'),
         ci.qty, ci.list_price, ci.unit_price, ci.discount_amount, 0, ci.line_total,
         ci.snapshot, ci.metadata
    FROM public.cart_items ci WHERE ci.cart_id = _cart_id;

  INSERT INTO public.order_addresses(
    order_id, store_id, kind, recipient, phone, email,
    postal_code, street, number, complement, district, city, state, country, snapshot
  ) VALUES (
    v_order_id, v_cart.store_id, 'shipping', _name, _phone, _email,
    _address->>'postal_code', _address->>'street', _address->>'number',
    _address->>'complement', _address->>'district', _address->>'city',
    _address->>'state', COALESCE(_address->>'country','BR'), _address
  ), (
    v_order_id, v_cart.store_id, 'billing', _name, _phone, _email,
    _address->>'postal_code', _address->>'street', _address->>'number',
    _address->>'complement', _address->>'district', _address->>'city',
    _address->>'state', COALESCE(_address->>'country','BR'), _address
  );

  PERFORM public.order_persist_shipping_snapshot(v_order_id, _cart_id);

  SELECT COALESCE(SUM(pv.weight_grams * ci.qty), 0)::numeric INTO v_total_weight
    FROM public.cart_items ci
    LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id
   WHERE ci.cart_id = _cart_id;

  SELECT settings INTO v_store_settings FROM public.stores WHERE id = v_cart.store_id;
  v_origin_postal := COALESCE(v_store_settings->'shipping'->>'origin_postal_code',
                              v_store_settings->>'origin_postal_code','');

  INSERT INTO public.fulfillments(
    store_id, fulfillment_number, fulfillable_type, fulfillable_id,
    type, priority, status, customer_id, schema_version, metadata
  ) VALUES (
    v_cart.store_id,
    'FUL-' || to_char(now(),'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8),
    'order'::fulfillment_fulfillable_type, v_order_id,
    'standard'::fulfillment_type, 'normal'::fulfillment_priority,
    'pending'::fulfillment_status, v_customer_id, 1,
    jsonb_build_object('source','storefront_checkout')
  ) RETURNING id INTO v_fulfillment_id;

  INSERT INTO public.shipments(
    store_id, fulfillment_id, code, status,
    carrier_code, service_code, service_name,
    currency, shipping_cost, weight_g, ship_from, ship_to,
    version, schema_version, metadata
  ) VALUES (
    v_cart.store_id, v_fulfillment_id,
    'SHP-' || to_char(now(),'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8),
    'created'::shipment_status,
    COALESCE(v_quote.provider_code, v_quote.carrier),
    v_quote.method_code, v_quote.method_name,
    v_cart.currency, v_quote.price, v_total_weight,
    jsonb_build_object('postal_code', v_origin_postal),
    jsonb_build_object('postal_code', _address->>'postal_code','street',_address->>'street',
      'number',_address->>'number','complement',_address->>'complement','district',_address->>'district',
      'city',_address->>'city','state',_address->>'state','country',COALESCE(_address->>'country','BR'),
      'recipient',_name,'phone',_phone,'email',_email),
    1, 1,
    jsonb_build_object('provider_code', v_quote.provider_code,
      'carrier_account_id', v_quote.carrier_account_id, 'quote_id', v_quote.id)
  );

  UPDATE public.carts SET status='converted', converted_order_id=v_order_id WHERE id=_cart_id;

  RETURN v_order_id;
END $function$;

-- ============================================================================
-- 6. order_cancel — idempotent stock return using stock_released_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.order_cancel(_order_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_store uuid;
  v_actor uuid := auth.uid();
  v_old public.order_status;
  v_stock_released timestamptz;
  r record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;

  SELECT store_id, status, stock_released_at
    INTO v_store, v_old, v_stock_released
    FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_store IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE='P0002'; END IF;

  IF NOT public.has_permission(v_actor, 'orders.cancel', v_store)
     AND NOT public.has_permission(v_actor, 'orders.write', v_store) THEN
    RAISE EXCEPTION 'forbidden: orders.cancel' USING ERRCODE='42501';
  END IF;

  -- Idempotency: already cancelled AND stock already released → no-op
  IF v_old = 'cancelled' AND v_stock_released IS NOT NULL THEN
    RETURN;
  END IF;

  IF v_old IN ('shipped','delivered','completed','refunded','returned') THEN
    RAISE EXCEPTION 'cannot cancel order in status %', v_old USING ERRCODE='22000';
  END IF;

  -- Only return stock once: guarded by stock_released_at IS NULL
  IF v_stock_released IS NULL THEN
    FOR r IN
      SELECT variant_id, warehouse_id, qty, id AS reservation_id
        FROM public.stock_reservations
       WHERE order_id = _order_id AND status = 'consumed'
       FOR UPDATE
    LOOP
      IF r.warehouse_id IS NOT NULL THEN
        PERFORM 1 FROM public.stock_levels
         WHERE store_id=v_store AND warehouse_id=r.warehouse_id AND variant_id=r.variant_id
         FOR UPDATE;
        UPDATE public.stock_levels
           SET quantity_on_hand = quantity_on_hand + r.qty,
               last_movement_at = now()
         WHERE store_id=v_store AND warehouse_id=r.warehouse_id AND variant_id=r.variant_id;

        INSERT INTO public.stock_movements(
          store_id, warehouse_id, variant_id, movement_type, quantity,
          reference_type, reference_id, notes, occurred_at, performed_by
        ) VALUES (
          v_store, r.warehouse_id, r.variant_id, 'sale_reverted', r.qty,
          'order', _order_id, 'Order cancelled - stock returned', now(), v_actor
        );
      END IF;
    END LOOP;

    UPDATE public.orders SET stock_released_at = now() WHERE id = _order_id;
  END IF;

  IF v_old <> 'cancelled' THEN
    UPDATE public.orders
       SET status='cancelled', cancelled_at=now(), cancellation_reason=_reason, updated_at=now()
     WHERE id = _order_id;

    PERFORM public._order_admin_log(_order_id, v_store, 'status_changed', 'Pedido cancelado',
      jsonb_build_object('from', v_old, 'to', 'cancelled', 'reason', _reason),
      v_actor, 'order.cancel',
      jsonb_build_object('status', v_old),
      jsonb_build_object('status','cancelled','reason',_reason));
  END IF;
END $function$;

-- ============================================================================
-- GRANTS (functions inherit invoker default; explicit for clarity)
-- ============================================================================
REVOKE ALL ON FUNCTION public._pick_warehouse_for_variant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_stock_reservations_for_order(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_stock_for_cart_item(uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.release_stock_reservation(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_cart_reservations() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.order_create_from_cart(uuid, text, text, text, jsonb, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.order_cancel(uuid, text) TO authenticated;
