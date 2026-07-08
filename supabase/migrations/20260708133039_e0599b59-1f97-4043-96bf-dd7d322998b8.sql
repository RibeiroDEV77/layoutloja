
CREATE OR REPLACE FUNCTION public.consume_stock_reservations_for_order(_order_id uuid, _cart_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid; ci record; v_res public.stock_reservations%ROWTYPE;
  v_warehouse uuid; v_level_id uuid; v_on_hand int; v_reserved int; v_reserved_portion int;
BEGIN
  SELECT store_id INTO v_store FROM public.orders WHERE id = _order_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Order % not found', _order_id USING ERRCODE='P0002'; END IF;
  FOR ci IN SELECT id, variant_id, qty FROM public.cart_items WHERE cart_id = _cart_id ORDER BY id LOOP
    IF ci.qty <= 0 THEN CONTINUE; END IF;
    SELECT * INTO v_res FROM public.stock_reservations WHERE cart_item_id = ci.id AND status = 'active' FOR UPDATE;
    IF FOUND THEN
      v_warehouse := v_res.warehouse_id; v_reserved_portion := v_res.qty;
    ELSE
      v_warehouse := public._pick_warehouse_for_variant(v_store, ci.variant_id);
      IF v_warehouse IS NULL THEN RAISE EXCEPTION 'No stock level for variant %', ci.variant_id USING ERRCODE='22000'; END IF;
      v_reserved_portion := 0;
    END IF;
    SELECT id, quantity_on_hand, quantity_reserved INTO v_level_id, v_on_hand, v_reserved
      FROM public.stock_levels WHERE store_id=v_store AND warehouse_id=v_warehouse AND variant_id=ci.variant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock level missing for variant % / warehouse %', ci.variant_id, v_warehouse USING ERRCODE='P0002'; END IF;
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
      UPDATE public.stock_reservations SET status='consumed', consumed_at=now(), order_id=_order_id, updated_at=now() WHERE id = v_res.id;
      INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, reason, metadata)
      VALUES (v_res.id, v_store, 'consume', ci.qty, 'order_create', jsonb_build_object('order_id', _order_id));
    END IF;
    INSERT INTO public.stock_movements(store_id, warehouse_id, variant_id, movement_type, quantity, reference_type, reference_id, notes, occurred_at)
    VALUES (v_store, v_warehouse, ci.variant_id, 'sale', -ci.qty, 'order', _order_id, 'Order placement consumption', now());
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.order_cancel(_order_id uuid, _reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_store uuid; v_actor uuid := auth.uid(); v_old public.order_status; v_stock_released timestamptz; r record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  SELECT store_id, status, stock_released_at INTO v_store, v_old, v_stock_released FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_store IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE='P0002'; END IF;
  IF NOT public.has_permission(v_actor, 'orders.cancel', v_store) AND NOT public.has_permission(v_actor, 'orders.write', v_store) THEN
    RAISE EXCEPTION 'forbidden: orders.cancel' USING ERRCODE='42501';
  END IF;
  IF v_old = 'cancelled' AND v_stock_released IS NOT NULL THEN RETURN; END IF;
  IF v_old IN ('shipped','delivered','completed','refunded','returned') THEN
    RAISE EXCEPTION 'cannot cancel order in status %', v_old USING ERRCODE='22000';
  END IF;
  IF v_stock_released IS NULL THEN
    FOR r IN SELECT variant_id, warehouse_id, qty, id AS reservation_id FROM public.stock_reservations
              WHERE order_id = _order_id AND status = 'consumed' FOR UPDATE LOOP
      IF r.warehouse_id IS NOT NULL THEN
        PERFORM 1 FROM public.stock_levels WHERE store_id=v_store AND warehouse_id=r.warehouse_id AND variant_id=r.variant_id FOR UPDATE;
        UPDATE public.stock_levels SET quantity_on_hand = quantity_on_hand + r.qty, last_movement_at = now()
         WHERE store_id=v_store AND warehouse_id=r.warehouse_id AND variant_id=r.variant_id;
        INSERT INTO public.stock_movements(store_id, warehouse_id, variant_id, movement_type, quantity, reference_type, reference_id, notes, occurred_at, performed_by)
        VALUES (v_store, r.warehouse_id, r.variant_id, 'sale_return', r.qty, 'order', _order_id, 'Order cancelled - stock returned', now(), v_actor);
      END IF;
    END LOOP;
    UPDATE public.orders SET stock_released_at = now() WHERE id = _order_id;
  END IF;
  IF v_old <> 'cancelled' THEN
    UPDATE public.orders SET status='cancelled', cancelled_at=now(), cancellation_reason=_reason, updated_at=now() WHERE id = _order_id;
    PERFORM public._order_admin_log(_order_id, v_store, 'status_changed', 'Pedido cancelado',
      jsonb_build_object('from', v_old, 'to', 'cancelled', 'reason', _reason),
      v_actor, 'order.cancel',
      jsonb_build_object('status', v_old),
      jsonb_build_object('status','cancelled','reason',_reason));
  END IF;
END $function$;
