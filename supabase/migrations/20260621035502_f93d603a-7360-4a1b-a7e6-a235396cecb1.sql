
-- =====================================================================
-- FULFILLMENT & LOGISTICS — MIGRATION 3/3
-- =====================================================================

CREATE OR REPLACE FUNCTION public._assert_fulfillment_permission(
  p_user_id uuid, p_permission text, p_store_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin(p_user_id) THEN RETURN; END IF;
  IF NOT public.has_permission(p_user_id, p_permission, p_store_id) THEN
    RAISE EXCEPTION 'Forbidden: missing permission % on store %', p_permission, p_store_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fulfillment_create(
  p_store_id uuid,
  p_fulfillable_type public.fulfillment_fulfillable_type,
  p_fulfillable_id uuid,
  p_warehouse_id uuid DEFAULT NULL,
  p_type public.fulfillment_type DEFAULT 'standard',
  p_priority public.fulfillment_priority DEFAULT 'normal',
  p_customer_id uuid DEFAULT NULL,
  p_sla_due_at timestamptz DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_trace_id uuid DEFAULT NULL,
  p_correlation_id uuid DEFAULT NULL,
  p_causation_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_fulfillment_id uuid;
  v_fulfillment_number text;
  v_item jsonb;
BEGIN
  PERFORM public._assert_fulfillment_permission(v_user_id, 'fulfillment.create', p_store_id);
  v_fulfillment_number := 'FUL-' || to_char(now(),'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);
  INSERT INTO public.fulfillments(
    store_id, fulfillment_number, fulfillable_type, fulfillable_id, warehouse_id,
    type, priority, status, customer_id, sla_due_at,
    trace_id, correlation_id, causation_id, schema_version, metadata, created_by
  ) VALUES (
    p_store_id, v_fulfillment_number, p_fulfillable_type, p_fulfillable_id, p_warehouse_id,
    p_type, p_priority, 'pending', p_customer_id, p_sla_due_at,
    p_trace_id, p_correlation_id, p_causation_id, 1, COALESCE(p_metadata,'{}'::jsonb), v_user_id
  ) RETURNING id INTO v_fulfillment_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb))
  LOOP
    INSERT INTO public.fulfillment_items(
      fulfillment_id, store_id, order_item_id, product_id, variant_id, sku, name,
      quantity_requested, unit_weight_g, unit_volume_cm3, snapshot, metadata
    ) VALUES (
      v_fulfillment_id, p_store_id,
      (v_item->>'order_item_id')::uuid,
      (v_item->>'product_id')::uuid,
      (v_item->>'variant_id')::uuid,
      v_item->>'sku',
      v_item->>'name',
      (v_item->>'quantity_requested')::numeric,
      NULLIF(v_item->>'unit_weight_g','')::numeric,
      NULLIF(v_item->>'unit_volume_cm3','')::numeric,
      COALESCE(v_item->'snapshot','{}'::jsonb),
      COALESCE(v_item->'metadata','{}'::jsonb)
    );
  END LOOP;

  INSERT INTO public.fulfillment_events(fulfillment_id, store_id, kind, actor_kind, actor_user_id, summary, trace_id, correlation_id)
  VALUES (v_fulfillment_id, p_store_id, 'created', 'user', v_user_id, 'Fulfillment created', p_trace_id, p_correlation_id);

  RETURN v_fulfillment_id;
END $$;

CREATE OR REPLACE FUNCTION public.fulfillment_allocate(
  p_fulfillment_id uuid, p_warehouse_id uuid, p_expected_version integer DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_store_id uuid; v_version integer;
BEGIN
  SELECT store_id, version INTO v_store_id, v_version FROM public.fulfillments WHERE id = p_fulfillment_id FOR UPDATE;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user_id, 'fulfillment.allocate', v_store_id);
  IF p_expected_version IS NOT NULL AND v_version <> p_expected_version THEN
    RAISE EXCEPTION 'Version conflict: expected %, got %', p_expected_version, v_version USING ERRCODE = 'serialization_failure';
  END IF;
  UPDATE public.fulfillments SET warehouse_id = p_warehouse_id, status = 'allocated', allocated_at = now() WHERE id = p_fulfillment_id;
  UPDATE public.fulfillment_items SET quantity_allocated = quantity_requested WHERE fulfillment_id = p_fulfillment_id;
  INSERT INTO public.fulfillment_events(fulfillment_id, store_id, kind, actor_kind, actor_user_id, summary)
  VALUES (p_fulfillment_id, v_store_id, 'allocated', 'user', v_user_id, 'Allocated to warehouse ' || p_warehouse_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.pick_list_create(
  p_store_id uuid, p_warehouse_id uuid, p_fulfillment_ids uuid[],
  p_strategy public.picking_strategy DEFAULT 'single_order',
  p_trace_id uuid DEFAULT NULL, p_correlation_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_pick_list_id uuid; v_code text; v_total integer;
BEGIN
  PERFORM public._assert_fulfillment_permission(v_user_id, 'fulfillment.pick', p_store_id);
  v_code := 'PL-' || to_char(now(),'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);
  INSERT INTO public.pick_lists(store_id, warehouse_id, code, strategy, status, trace_id, correlation_id, schema_version, created_by)
    VALUES (p_store_id, p_warehouse_id, v_code, p_strategy, 'draft', p_trace_id, p_correlation_id, 1, v_user_id)
    RETURNING id INTO v_pick_list_id;
  INSERT INTO public.pick_list_items(pick_list_id, fulfillment_id, fulfillment_item_id, store_id, sku, bin_location, quantity_requested)
  SELECT v_pick_list_id, fi.fulfillment_id, fi.id, fi.store_id, fi.sku, NULL, (fi.quantity_requested - fi.quantity_picked)
    FROM public.fulfillment_items fi
   WHERE fi.fulfillment_id = ANY(p_fulfillment_ids) AND (fi.quantity_requested - fi.quantity_picked) > 0;
  SELECT COUNT(*) INTO v_total FROM public.pick_list_items WHERE pick_list_id = v_pick_list_id;
  UPDATE public.pick_lists SET total_items = v_total WHERE id = v_pick_list_id;
  RETURN v_pick_list_id;
END $$;

CREATE OR REPLACE FUNCTION public.pick_list_assign(p_pick_list_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_store uuid;
BEGIN
  SELECT store_id INTO v_store FROM public.pick_lists WHERE id = p_pick_list_id FOR UPDATE;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Pick list not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.pick', v_store);
  UPDATE public.pick_lists SET assigned_to = p_user_id, status = 'assigned' WHERE id = p_pick_list_id;
END $$;

CREATE OR REPLACE FUNCTION public.pick_list_start(p_pick_list_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_store uuid;
BEGIN
  SELECT store_id INTO v_store FROM public.pick_lists WHERE id = p_pick_list_id FOR UPDATE;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Pick list not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.pick', v_store);
  UPDATE public.pick_lists SET status = 'in_progress', started_at = now() WHERE id = p_pick_list_id;
END $$;

CREATE OR REPLACE FUNCTION public.pick_list_confirm_pick(
  p_pick_list_item_id uuid, p_quantity_picked numeric,
  p_bin_location text DEFAULT NULL, p_trace_id uuid DEFAULT NULL, p_correlation_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pli record; v_fi record; v_ful record;
  v_warehouse uuid; v_qty_int integer; v_remaining numeric;
  v_reservation record; v_to_consume numeric;
BEGIN
  SELECT * INTO v_pli FROM public.pick_list_items WHERE id = p_pick_list_item_id FOR UPDATE;
  IF v_pli.id IS NULL THEN RAISE EXCEPTION 'Pick list item not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user_id, 'fulfillment.pick', v_pli.store_id);
  IF p_quantity_picked <= 0 THEN RAISE EXCEPTION 'quantity_picked must be > 0'; END IF;
  IF v_pli.quantity_picked + p_quantity_picked > v_pli.quantity_requested THEN
    RAISE EXCEPTION 'quantity_picked (%) exceeds remaining (%)', p_quantity_picked, (v_pli.quantity_requested - v_pli.quantity_picked);
  END IF;
  SELECT * INTO v_fi FROM public.fulfillment_items WHERE id = v_pli.fulfillment_item_id FOR UPDATE;
  SELECT * INTO v_ful FROM public.fulfillments WHERE id = v_fi.fulfillment_id FOR UPDATE;
  v_warehouse := v_ful.warehouse_id;
  IF v_warehouse IS NULL THEN RAISE EXCEPTION 'Fulfillment has no warehouse allocated'; END IF;
  IF v_fi.variant_id IS NULL THEN RAISE EXCEPTION 'Fulfillment item has no variant_id'; END IF;
  v_qty_int := ceil(p_quantity_picked)::integer;

  IF v_ful.fulfillable_type = 'order' THEN
    v_remaining := v_qty_int;
    FOR v_reservation IN
      SELECT * FROM public.stock_reservations
       WHERE order_id = v_ful.fulfillable_id AND variant_id = v_fi.variant_id AND status = 'active'
       ORDER BY created_at ASC FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_to_consume := LEAST(v_reservation.qty, v_remaining);
      IF v_to_consume = v_reservation.qty THEN
        UPDATE public.stock_reservations SET status = 'consumed', consumed_at = now() WHERE id = v_reservation.id;
      ELSE
        UPDATE public.stock_reservations SET qty = qty - v_to_consume::integer WHERE id = v_reservation.id;
        INSERT INTO public.stock_reservations(
          store_id, order_id, variant_id, warehouse_id, qty, status, expires_at, consumed_at, metadata
        ) VALUES (
          v_reservation.store_id, v_reservation.order_id, v_reservation.variant_id,
          v_reservation.warehouse_id, v_to_consume::integer, 'consumed',
          v_reservation.expires_at, now(), jsonb_build_object('split_from', v_reservation.id)
        );
      END IF;
      INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, actor_user_id, reason, metadata)
      VALUES (
        v_reservation.id, v_reservation.store_id, 'consume', v_to_consume::integer, v_user_id, 'pick_confirm',
        jsonb_build_object('fulfillment_id', v_ful.id, 'fulfillment_item_id', v_fi.id, 'pick_list_item_id', v_pli.id)
      );
      v_remaining := v_remaining - v_to_consume;
    END LOOP;
  END IF;

  UPDATE public.stock_levels
     SET quantity_on_hand = quantity_on_hand - v_qty_int,
         quantity_reserved = GREATEST(0, quantity_reserved - v_qty_int),
         last_movement_at = now()
   WHERE warehouse_id = v_warehouse AND variant_id = v_fi.variant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stock_levels row for warehouse=% variant=%', v_warehouse, v_fi.variant_id;
  END IF;

  INSERT INTO public.stock_movements(
    store_id, warehouse_id, variant_id, movement_type, quantity,
    reference_type, reference_id, notes, performed_by, occurred_at
  ) VALUES (
    v_pli.store_id, v_warehouse, v_fi.variant_id, 'outbound_pick', -v_qty_int,
    'fulfillment_item', v_fi.id, 'pick_confirm', v_user_id, now()
  );

  UPDATE public.pick_list_items
     SET quantity_picked = quantity_picked + p_quantity_picked,
         picked_by = v_user_id, picked_at = now(),
         bin_location = COALESCE(p_bin_location, bin_location)
   WHERE id = p_pick_list_item_id;
  UPDATE public.fulfillment_items SET quantity_picked = quantity_picked + p_quantity_picked WHERE id = v_fi.id;
  UPDATE public.pick_lists
     SET completed_items = completed_items + CASE WHEN (v_pli.quantity_picked + p_quantity_picked) >= v_pli.quantity_requested THEN 1 ELSE 0 END
   WHERE id = v_pli.pick_list_id;

  INSERT INTO public.fulfillment_events(
    fulfillment_id, store_id, kind, actor_kind, actor_user_id, summary, payload, trace_id, correlation_id
  ) VALUES (
    v_fi.fulfillment_id, v_fi.store_id, 'picked', 'user', v_user_id,
    'Item picked: ' || COALESCE(v_fi.sku,'?') || ' qty=' || p_quantity_picked,
    jsonb_build_object('fulfillment_item_id', v_fi.id, 'pick_list_item_id', v_pli.id,
                       'quantity_picked', p_quantity_picked, 'warehouse_id', v_warehouse),
    p_trace_id, p_correlation_id
  );
END $$;

CREATE OR REPLACE FUNCTION public.pick_list_complete(p_pick_list_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_store uuid; v_open integer; v_ful uuid;
BEGIN
  SELECT store_id INTO v_store FROM public.pick_lists WHERE id = p_pick_list_id FOR UPDATE;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Pick list not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.pick', v_store);
  SELECT COUNT(*) INTO v_open FROM public.pick_list_items
    WHERE pick_list_id = p_pick_list_id AND quantity_picked < quantity_requested;
  IF v_open > 0 THEN RAISE EXCEPTION 'Pick list has % unfinished item(s)', v_open; END IF;
  UPDATE public.pick_lists SET status = 'completed', completed_at = now() WHERE id = p_pick_list_id;
  FOR v_ful IN SELECT DISTINCT pli.fulfillment_id FROM public.pick_list_items pli WHERE pli.pick_list_id = p_pick_list_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.fulfillment_items WHERE fulfillment_id = v_ful AND quantity_picked < quantity_requested) THEN
      UPDATE public.fulfillments SET status = 'picked', picked_at = now() WHERE id = v_ful AND status IN ('allocated','picking');
      INSERT INTO public.fulfillment_events(fulfillment_id, store_id, kind, actor_kind, actor_user_id, summary)
        VALUES (v_ful, v_store, 'status_changed', 'user', v_user, 'Fulfillment fully picked');
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.package_create(p_fulfillment_id uuid, p_code text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_store uuid; v_pkg uuid; v_code text;
BEGIN
  SELECT store_id INTO v_store FROM public.fulfillments WHERE id = p_fulfillment_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.pack', v_store);
  v_code := COALESCE(p_code, 'PKG-' || substr(replace(gen_random_uuid()::text,'-',''),1,10));
  INSERT INTO public.packages(store_id, fulfillment_id, code, status, packed_by, packed_at)
    VALUES (v_store, p_fulfillment_id, v_code, 'open', v_user, now()) RETURNING id INTO v_pkg;
  RETURN v_pkg;
END $$;

CREATE OR REPLACE FUNCTION public.package_add_item(
  p_package_id uuid, p_fulfillment_item_id uuid, p_quantity numeric, p_serial_numbers jsonb DEFAULT '[]'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_pkg record; v_fi record; v_id uuid;
BEGIN
  SELECT * INTO v_pkg FROM public.packages WHERE id = p_package_id FOR UPDATE;
  IF v_pkg.id IS NULL THEN RAISE EXCEPTION 'Package not found'; END IF;
  IF v_pkg.status <> 'open' THEN RAISE EXCEPTION 'Package is not open'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.pack', v_pkg.store_id);
  SELECT * INTO v_fi FROM public.fulfillment_items WHERE id = p_fulfillment_item_id FOR UPDATE;
  IF v_fi.id IS NULL THEN RAISE EXCEPTION 'Fulfillment item not found'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0'; END IF;
  IF v_fi.quantity_packed + p_quantity > v_fi.quantity_picked THEN
    RAISE EXCEPTION 'Cannot pack more than picked (packed=% picked=% trying=+%)', v_fi.quantity_packed, v_fi.quantity_picked, p_quantity;
  END IF;
  INSERT INTO public.package_items(package_id, fulfillment_item_id, store_id, quantity, serial_numbers)
    VALUES (p_package_id, p_fulfillment_item_id, v_pkg.store_id, p_quantity, COALESCE(p_serial_numbers,'[]'::jsonb))
    RETURNING id INTO v_id;
  UPDATE public.fulfillment_items SET quantity_packed = quantity_packed + p_quantity WHERE id = p_fulfillment_item_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.package_seal(
  p_package_id uuid, p_weight_g numeric DEFAULT NULL,
  p_length_cm numeric DEFAULT NULL, p_width_cm numeric DEFAULT NULL, p_height_cm numeric DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_pkg record;
BEGIN
  SELECT * INTO v_pkg FROM public.packages WHERE id = p_package_id FOR UPDATE;
  IF v_pkg.id IS NULL THEN RAISE EXCEPTION 'Package not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.pack', v_pkg.store_id);
  UPDATE public.packages SET status = 'sealed', sealed_at = now(),
    weight_g = COALESCE(p_weight_g, weight_g), length_cm = COALESCE(p_length_cm, length_cm),
    width_cm = COALESCE(p_width_cm, width_cm), height_cm = COALESCE(p_height_cm, height_cm)
   WHERE id = p_package_id;
  IF NOT EXISTS (SELECT 1 FROM public.fulfillment_items WHERE fulfillment_id = v_pkg.fulfillment_id AND quantity_packed < quantity_picked)
     AND EXISTS (SELECT 1 FROM public.fulfillments WHERE id = v_pkg.fulfillment_id AND status = 'picked') THEN
    UPDATE public.fulfillments SET status = 'packed', packed_at = now() WHERE id = v_pkg.fulfillment_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.shipment_create_split(
  p_fulfillment_id uuid, p_carrier_code text, p_service_code text, p_package_ids uuid[],
  p_ship_from jsonb DEFAULT '{}'::jsonb, p_ship_to jsonb DEFAULT '{}'::jsonb,
  p_declared_value numeric DEFAULT NULL, p_estimated_delivery_at timestamptz DEFAULT NULL,
  p_trace_id uuid DEFAULT NULL, p_correlation_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_store uuid; v_shipment uuid; v_code text; v_pkg uuid; v_total_weight numeric := 0;
BEGIN
  SELECT store_id INTO v_store FROM public.fulfillments WHERE id = p_fulfillment_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.ship', v_store);
  IF p_package_ids IS NULL OR array_length(p_package_ids,1) IS NULL THEN RAISE EXCEPTION 'At least one package required'; END IF;
  v_code := 'SHP-' || to_char(now(),'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);
  INSERT INTO public.shipments(
    store_id, fulfillment_id, code, status, carrier_code, service_code,
    declared_value, ship_from, ship_to, estimated_delivery_at,
    trace_id, correlation_id, schema_version, created_by
  ) VALUES (
    v_store, p_fulfillment_id, v_code, 'created', p_carrier_code, p_service_code,
    p_declared_value, COALESCE(p_ship_from,'{}'::jsonb), COALESCE(p_ship_to,'{}'::jsonb),
    p_estimated_delivery_at, p_trace_id, p_correlation_id, 1, v_user
  ) RETURNING id INTO v_shipment;
  FOREACH v_pkg IN ARRAY p_package_ids
  LOOP
    INSERT INTO public.shipment_packages(shipment_id, package_id, store_id) VALUES (v_shipment, v_pkg, v_store);
    SELECT COALESCE(v_total_weight,0) + COALESCE(weight_g,0) INTO v_total_weight FROM public.packages WHERE id = v_pkg;
  END LOOP;
  UPDATE public.shipments SET weight_g = v_total_weight WHERE id = v_shipment;
  RETURN v_shipment;
END $$;

CREATE OR REPLACE FUNCTION public.shipment_purchase_label(
  p_shipment_id uuid, p_tracking_number text, p_tracking_url text, p_label_url text,
  p_format public.shipping_label_format DEFAULT 'pdf', p_cost numeric DEFAULT NULL, p_carrier_label_id text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_shp record; v_label uuid;
BEGIN
  SELECT * INTO v_shp FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_shp.id IS NULL THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.ship', v_shp.store_id);
  INSERT INTO public.shipping_labels(shipment_id, store_id, format, url, cost, carrier_label_id)
    VALUES (p_shipment_id, v_shp.store_id, p_format, p_label_url, p_cost, p_carrier_label_id)
    RETURNING id INTO v_label;
  UPDATE public.shipments SET tracking_number = p_tracking_number, tracking_url = p_tracking_url,
    shipping_cost = COALESCE(p_cost, shipping_cost), status = 'label_purchased' WHERE id = p_shipment_id;
  INSERT INTO public.tracking_events(shipment_id, store_id, kind, occurred_at, description, source)
    VALUES (p_shipment_id, v_shp.store_id, 'label_purchased', now(), 'Label purchased', 'system');
  RETURN v_label;
END $$;

CREATE OR REPLACE FUNCTION public.shipment_dispatch(p_shipment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_shp record;
BEGIN
  SELECT * INTO v_shp FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_shp.id IS NULL THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.ship', v_shp.store_id);
  UPDATE public.shipments SET status = 'dispatched', dispatched_at = now() WHERE id = p_shipment_id;
  UPDATE public.fulfillment_items fi
     SET quantity_shipped = fi.quantity_shipped + agg.total
    FROM (
      SELECT pi.fulfillment_item_id AS fi_id, SUM(pi.quantity) AS total
        FROM public.package_items pi
        JOIN public.shipment_packages sp ON sp.package_id = pi.package_id
       WHERE sp.shipment_id = p_shipment_id GROUP BY pi.fulfillment_item_id
    ) AS agg WHERE fi.id = agg.fi_id;
  INSERT INTO public.tracking_events(shipment_id, store_id, kind, occurred_at, description, source)
    VALUES (p_shipment_id, v_shp.store_id, 'picked_up', now(), 'Shipment dispatched', 'system');
  IF NOT EXISTS (SELECT 1 FROM public.fulfillment_items WHERE fulfillment_id = v_shp.fulfillment_id AND quantity_shipped < quantity_picked)
     AND EXISTS (SELECT 1 FROM public.fulfillments WHERE id = v_shp.fulfillment_id AND status IN ('packed','shipping')) THEN
    UPDATE public.fulfillments SET status = 'shipped', shipped_at = now() WHERE id = v_shp.fulfillment_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tracking_event_ingest(
  p_shipment_id uuid, p_kind public.tracking_event_kind, p_occurred_at timestamptz,
  p_location text DEFAULT NULL, p_description text DEFAULT NULL,
  p_source text DEFAULT 'carrier', p_raw_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_shp record; v_id uuid; v_new_status public.shipment_status;
BEGIN
  SELECT * INTO v_shp FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_shp.id IS NULL THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF v_user IS NOT NULL THEN PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.ship', v_shp.store_id); END IF;
  INSERT INTO public.tracking_events(shipment_id, store_id, kind, occurred_at, location, description, source, raw_payload)
    VALUES (p_shipment_id, v_shp.store_id, p_kind, p_occurred_at, p_location, p_description, p_source, COALESCE(p_raw_payload,'{}'::jsonb))
    RETURNING id INTO v_id;
  v_new_status := CASE p_kind
    WHEN 'picked_up'        THEN 'dispatched'::public.shipment_status
    WHEN 'in_transit'       THEN 'in_transit'::public.shipment_status
    WHEN 'out_for_delivery' THEN 'in_transit'::public.shipment_status
    WHEN 'delivered'        THEN 'delivered'::public.shipment_status
    WHEN 'returned'         THEN 'returned'::public.shipment_status
    WHEN 'lost'             THEN 'lost'::public.shipment_status
    ELSE NULL END;
  IF v_new_status IS NOT NULL AND v_new_status <> v_shp.status THEN
    BEGIN
      UPDATE public.shipments SET status = v_new_status,
        delivered_at = CASE WHEN v_new_status = 'delivered' THEN p_occurred_at ELSE delivered_at END,
        returned_at  = CASE WHEN v_new_status = 'returned'  THEN p_occurred_at ELSE returned_at END
       WHERE id = p_shipment_id;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_attempt_register(
  p_shipment_id uuid, p_outcome public.delivery_attempt_outcome,
  p_signed_by text DEFAULT NULL, p_proof_asset_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL, p_raw_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_shp record; v_attempt integer; v_id uuid;
BEGIN
  SELECT * INTO v_shp FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_shp.id IS NULL THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF v_user IS NOT NULL THEN PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.ship', v_shp.store_id); END IF;
  SELECT COALESCE(MAX(attempt_number),0) + 1 INTO v_attempt FROM public.delivery_attempts WHERE shipment_id = p_shipment_id;
  INSERT INTO public.delivery_attempts(shipment_id, store_id, attempt_number, outcome, attempted_at, signed_by, proof_asset_id, notes, raw_payload)
    VALUES (p_shipment_id, v_shp.store_id, v_attempt, p_outcome, now(), p_signed_by, p_proof_asset_id, p_notes, COALESCE(p_raw_payload,'{}'::jsonb))
    RETURNING id INTO v_id;
  INSERT INTO public.tracking_events(shipment_id, store_id, kind, occurred_at, description, source, raw_payload)
    VALUES (p_shipment_id, v_shp.store_id,
            CASE WHEN p_outcome='success' THEN 'delivered'::public.tracking_event_kind ELSE 'delivery_attempted' END,
            now(), p_notes, 'carrier', COALESCE(p_raw_payload,'{}'::jsonb));
  IF p_outcome = 'success' AND v_shp.status NOT IN ('delivered','returned','lost') THEN
    UPDATE public.shipments SET status='delivered', delivered_at=now() WHERE id=p_shipment_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fulfillment_mark_delivered(p_fulfillment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_ful record;
BEGIN
  SELECT * INTO v_ful FROM public.fulfillments WHERE id = p_fulfillment_id FOR UPDATE;
  IF v_ful.id IS NULL THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  IF v_user IS NOT NULL THEN PERFORM public._assert_fulfillment_permission(v_user, 'fulfillment.ship', v_ful.store_id); END IF;
  IF EXISTS (SELECT 1 FROM public.shipments WHERE fulfillment_id = p_fulfillment_id AND status <> 'delivered') THEN
    RAISE EXCEPTION 'Not all shipments delivered';
  END IF;
  UPDATE public.fulfillment_items SET quantity_delivered = quantity_shipped WHERE fulfillment_id = p_fulfillment_id;
  UPDATE public.fulfillments SET status='delivered', delivered_at=now() WHERE id=p_fulfillment_id;
  INSERT INTO public.fulfillment_events(fulfillment_id, store_id, kind, actor_kind, actor_user_id, summary)
    VALUES (p_fulfillment_id, v_ful.store_id, 'delivered', 'user', v_user, 'Fulfillment marked delivered');
END $$;

GRANT EXECUTE ON FUNCTION public.fulfillment_create(uuid,public.fulfillment_fulfillable_type,uuid,uuid,public.fulfillment_type,public.fulfillment_priority,uuid,timestamptz,jsonb,uuid,uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfillment_allocate(uuid,uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pick_list_create(uuid,uuid,uuid[],public.picking_strategy,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pick_list_assign(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pick_list_start(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pick_list_confirm_pick(uuid,numeric,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pick_list_complete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.package_create(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.package_add_item(uuid,uuid,numeric,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.package_seal(uuid,numeric,numeric,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_create_split(uuid,text,text,uuid[],jsonb,jsonb,numeric,timestamptz,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_purchase_label(uuid,text,text,text,public.shipping_label_format,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_dispatch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tracking_event_ingest(uuid,public.tracking_event_kind,timestamptz,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_attempt_register(uuid,public.delivery_attempt_outcome,text,uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfillment_mark_delivered(uuid) TO authenticated;

-- =====================================================================
-- SEED: workflow_definitions  (fulfillment.v1)
-- =====================================================================
INSERT INTO public.workflow_definitions (store_id, code, name, aggregate_type, version, description, is_active, metadata)
VALUES (
  NULL, 'fulfillment.v1', 'Fulfillment Lifecycle', 'fulfillment', 1,
  'Canonical 12-state fulfillment workflow (pending → delivered)', true,
  jsonb_build_object(
    'states', jsonb_build_array(
      'pending','allocated','picking','picked','packing','packed',
      'shipping','shipped','in_transit','delivered','cancelled','failed'),
    'transitions', jsonb_build_object(
      'pending', jsonb_build_array('allocated','cancelled'),
      'allocated', jsonb_build_array('picking','cancelled'),
      'picking', jsonb_build_array('picked','cancelled','failed'),
      'picked', jsonb_build_array('packing','cancelled'),
      'packing', jsonb_build_array('packed','cancelled','failed'),
      'packed', jsonb_build_array('shipping','cancelled'),
      'shipping', jsonb_build_array('shipped','failed'),
      'shipped', jsonb_build_array('in_transit','delivered','failed'),
      'in_transit', jsonb_build_array('delivered','failed'),
      'failed', jsonb_build_array('pending','cancelled')
    )
  )
)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- SEED: system_settings → carrier catalog (frozen)
-- =====================================================================
DO $seed$
DECLARE v_store record;
BEGIN
  FOR v_store IN SELECT id FROM public.stores LOOP
    INSERT INTO public.system_settings (scope, store_id, key, value, value_type, description, is_secret)
    VALUES (
      'store', v_store.id, 'fulfillment.carriers',
      jsonb_build_array(
        jsonb_build_object('code','correios','name','Correios','services', jsonb_build_array('PAC','SEDEX','SEDEX10')),
        jsonb_build_object('code','jadlog','name','Jadlog','services', jsonb_build_array('PACKAGE','EXPRESSO','ECONOMICO')),
        jsonb_build_object('code','loggi','name','Loggi','services', jsonb_build_array('LOGGI_EXPRESS','LOGGI_TRUCK')),
        jsonb_build_object('code','melhor_envio','name','Melhor Envio','services', jsonb_build_array('AGGREGATOR')),
        jsonb_build_object('code','manual','name','Manual / Retirada','services', jsonb_build_array('PICKUP','OWN_DELIVERY'))
      ),
      'json',
      'Catálogo de carriers do Fulfillment & Logistics (frozen).',
      false
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $seed$;
