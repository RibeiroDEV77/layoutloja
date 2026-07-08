
CREATE OR REPLACE FUNCTION public.reserve_stock_for_cart_item(_cart_item_id uuid, _ttl_seconds integer DEFAULT 1800)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_event cart_timeline_event;
BEGIN
  SELECT * INTO v_item FROM public.cart_items WHERE id = _cart_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cart item % not found', _cart_item_id USING ERRCODE='P0002'; END IF;
  IF v_item.qty <= 0 THEN RAISE EXCEPTION 'qty must be > 0' USING ERRCODE='22000'; END IF;

  SELECT * INTO v_cart FROM public.carts WHERE id = v_item.cart_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cart % not found', v_item.cart_id USING ERRCODE='P0002'; END IF;
  IF v_cart.status <> 'active' THEN
    RAISE EXCEPTION 'Cart % not active (status=%)', v_cart.id, v_cart.status USING ERRCODE='22000';
  END IF;

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
    v_event := 'reservation_extended';
  ELSE
    INSERT INTO public.stock_reservations(
      store_id, cart_id, cart_item_id, variant_id, warehouse_id, qty, status, expires_at
    ) VALUES (
      v_cart.store_id, v_cart.id, v_item.id, v_item.variant_id, v_warehouse, v_item.qty,
      'active', now() + make_interval(secs => _ttl_seconds)
    ) RETURNING id INTO v_res_id;
    v_event := 'reservation_created';
  END IF;

  INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, actor_user_id, reason, metadata)
  VALUES (
    v_res_id, v_cart.store_id,
    CASE WHEN v_delta >= 0 THEN 'reserve'::reservation_ledger_kind ELSE 'release'::reservation_ledger_kind END,
    ABS(v_delta), auth.uid(),
    CASE WHEN v_delta = 0 THEN 'noop' WHEN v_delta > 0 THEN 'reserve_delta' ELSE 'release_delta' END,
    jsonb_build_object('cart_item_id', _cart_item_id, 'delta', v_delta, 'new_qty', v_item.qty)
  );

  PERFORM public.record_cart_timeline_event(v_cart.id, v_event,
    jsonb_build_object('reservation_id', v_res_id, 'variant_id', v_item.variant_id, 'qty', v_item.qty, 'delta', v_delta));

  RETURN v_res_id;
END $function$;
