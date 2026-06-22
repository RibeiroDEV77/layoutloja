
CREATE OR REPLACE FUNCTION public.order_create_from_cart(
  _cart_id uuid,
  _email   text,
  _name    text,
  _phone   text,
  _address jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail para o pedido';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Informe seu nome';
  END IF;
  IF _address IS NULL OR coalesce(_address->>'postal_code','') = '' THEN
    RAISE EXCEPTION 'Endereço de entrega obrigatório';
  END IF;

  SELECT * INTO v_cart FROM public.carts WHERE id = _cart_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carrinho não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_cart.status <> 'active' THEN
    RAISE EXCEPTION 'Carrinho não está ativo (status=%)', v_cart.status;
  END IF;
  IF (SELECT count(*) FROM public.cart_items WHERE cart_id = _cart_id) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  SELECT * INTO v_quote
    FROM public.shipping_quotes
   WHERE cart_id = _cart_id AND selected = true
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selecione uma modalidade de frete antes de finalizar';
  END IF;

  -- customer (find by email or create)
  SELECT id INTO v_customer_id
    FROM public.customers
   WHERE store_id = v_cart.store_id AND lower(email) = lower(_email)
   LIMIT 1;
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
    items_count, placed_at, metadata
  ) VALUES (
    v_cart.store_id, v_order_number, 'pending_payment', 'storefront', _cart_id, v_customer_id,
    _email, _phone, v_cart.currency,
    v_cart.subtotal, v_cart.discount_total, v_cart.shipping_total, v_cart.tax_total, 0, v_cart.total,
    v_cart.items_count, now(),
    jsonb_build_object('source','storefront_checkout')
  ) RETURNING id INTO v_order_id;

  -- copy items
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
    FROM public.cart_items ci
   WHERE ci.cart_id = _cart_id;

  -- shipping + billing addresses (same payload)
  INSERT INTO public.order_addresses(
    order_id, store_id, kind, recipient, phone, email,
    postal_code, street, number, complement, district, city, state, country, snapshot
  ) VALUES (
    v_order_id, v_cart.store_id, 'shipping', _name, _phone, _email,
    _address->>'postal_code', _address->>'street', _address->>'number',
    _address->>'complement', _address->>'district', _address->>'city',
    _address->>'state', COALESCE(_address->>'country','BR'),
    _address
  ), (
    v_order_id, v_cart.store_id, 'billing', _name, _phone, _email,
    _address->>'postal_code', _address->>'street', _address->>'number',
    _address->>'complement', _address->>'district', _address->>'city',
    _address->>'state', COALESCE(_address->>'country','BR'),
    _address
  );

  -- persist shipping snapshot (carrier/service/price/eta)
  PERFORM public.order_persist_shipping_snapshot(v_order_id, _cart_id);

  -- compute total weight (g)
  SELECT COALESCE(SUM(pv.weight_grams * ci.qty), 0)::numeric INTO v_total_weight
    FROM public.cart_items ci
    LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id
   WHERE ci.cart_id = _cart_id;

  -- origin postal from store settings (best-effort)
  SELECT settings INTO v_store_settings FROM public.stores WHERE id = v_cart.store_id;
  v_origin_postal := COALESCE(
    v_store_settings->'shipping'->>'origin_postal_code',
    v_store_settings->>'origin_postal_code',
    ''
  );

  -- fulfillment + shipment (skeleton so admin can purchase label later)
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
    jsonb_build_object(
      'postal_code', _address->>'postal_code',
      'street',      _address->>'street',
      'number',      _address->>'number',
      'complement',  _address->>'complement',
      'district',    _address->>'district',
      'city',        _address->>'city',
      'state',       _address->>'state',
      'country',     COALESCE(_address->>'country','BR'),
      'recipient',   _name,
      'phone',       _phone,
      'email',       _email
    ),
    1, 1,
    jsonb_build_object(
      'provider_code', v_quote.provider_code,
      'carrier_account_id', v_quote.carrier_account_id,
      'quote_id', v_quote.id
    )
  );

  -- mark cart converted
  UPDATE public.carts
     SET status = 'converted', converted_order_id = v_order_id
   WHERE id = _cart_id;

  RETURN v_order_id;
END $$;

GRANT EXECUTE ON FUNCTION public.order_create_from_cart(uuid, text, text, text, jsonb) TO anon, authenticated, service_role;
