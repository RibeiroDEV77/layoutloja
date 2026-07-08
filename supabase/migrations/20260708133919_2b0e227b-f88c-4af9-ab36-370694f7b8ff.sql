
CREATE OR REPLACE FUNCTION public.order_create_from_cart(
  _cart_id uuid, _email text, _name text, _phone text, _address jsonb, _idempotency_key text DEFAULT NULL::text
)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cart           public.carts%ROWTYPE;
  v_quote          public.shipping_quotes%ROWTYPE;
  v_customer_id    uuid;
  v_customer_auth  uuid;
  v_order_id       uuid;
  v_order_number   text;
  v_fulfillment_id uuid;
  v_total_weight   numeric := 0;
  v_store_settings jsonb;
  v_origin_postal  text;
  v_existing_order uuid;
  ci               record;
  v_prod           public.products%ROWTYPE;
  v_variant        public.product_variants%ROWTYPE;
  v_expected_price numeric;
BEGIN
  -- ============ Input basics ============
  IF _email IS NULL OR length(trim(_email)) = 0 THEN RAISE EXCEPTION 'Informe um e-mail para o pedido' USING ERRCODE='22000'; END IF;
  IF _name  IS NULL OR length(trim(_name))  = 0 THEN RAISE EXCEPTION 'Informe seu nome' USING ERRCODE='22000'; END IF;
  IF _address IS NULL OR coalesce(_address->>'postal_code','') = '' THEN
    RAISE EXCEPTION 'Endereço de entrega obrigatório' USING ERRCODE='22000';
  END IF;

  -- ============ Lock cart ============
  SELECT * INTO v_cart FROM public.carts WHERE id = _cart_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carrinho não encontrado' USING ERRCODE='P0002'; END IF;

  -- ============ Idempotency short-circuits ============
  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_order FROM public.orders
     WHERE store_id = v_cart.store_id AND idempotency_key = _idempotency_key LIMIT 1;
    IF v_existing_order IS NOT NULL THEN RETURN v_existing_order; END IF;
  END IF;

  IF v_cart.status = 'converted' THEN
    SELECT id INTO v_existing_order FROM public.orders
     WHERE store_id = v_cart.store_id AND source_cart_id = _cart_id AND status <> 'cancelled'
     ORDER BY placed_at DESC NULLS LAST LIMIT 1;
    IF v_existing_order IS NOT NULL THEN RETURN v_existing_order; END IF;
    RAISE EXCEPTION 'Carrinho já convertido' USING ERRCODE='22000';
  END IF;

  IF v_cart.status <> 'active' THEN
    RAISE EXCEPTION 'Carrinho não está ativo (status=%)', v_cart.status USING ERRCODE='22000';
  END IF;
  IF (SELECT count(*) FROM public.cart_items WHERE cart_id = _cart_id) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio' USING ERRCODE='22000';
  END IF;

  -- ============ Channel / ownership hardening ============
  IF v_cart.sales_channel = 'wholesale' THEN
    IF v_cart.customer_id IS NULL THEN
      RAISE EXCEPTION 'Carrinho atacado exige cliente identificado' USING ERRCODE='42501';
    END IF;
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Autenticação obrigatória para checkout atacado' USING ERRCODE='42501';
    END IF;
    SELECT auth_user_id INTO v_customer_auth FROM public.customers WHERE id = v_cart.customer_id;
    IF v_customer_auth IS NULL OR v_customer_auth <> auth.uid() THEN
      RAISE EXCEPTION 'Carrinho atacado não pertence ao usuário autenticado' USING ERRCODE='42501';
    END IF;
    IF NOT public.is_approved_wholesale_customer(auth.uid(), v_cart.store_id) THEN
      RAISE EXCEPTION 'Cadastro atacado não aprovado' USING ERRCODE='42501';
    END IF;
    IF v_cart.price_list_id IS NULL THEN
      RAISE EXCEPTION 'Carrinho atacado sem lista de preço vinculada' USING ERRCODE='22000';
    END IF;
    -- price_list must belong to same store and be active
    PERFORM 1 FROM public.price_lists
     WHERE id = v_cart.price_list_id AND store_id = v_cart.store_id AND is_active
       AND (starts_at IS NULL OR starts_at <= now())
       AND (ends_at   IS NULL OR ends_at   >= now());
    IF NOT FOUND THEN RAISE EXCEPTION 'Lista de preço atacado inválida ou expirada' USING ERRCODE='22000'; END IF;
  END IF;

  -- ============ Per-item validation ============
  FOR ci IN SELECT * FROM public.cart_items WHERE cart_id = _cart_id LOOP
    IF ci.qty <= 0 THEN
      RAISE EXCEPTION 'Item com qty inválida (cart_item=%)', ci.id USING ERRCODE='22000';
    END IF;

    SELECT * INTO v_prod FROM public.products WHERE id = ci.product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % não encontrado', ci.product_id USING ERRCODE='P0002';
    END IF;
    IF v_prod.store_id <> v_cart.store_id THEN
      RAISE EXCEPTION 'Produto % não pertence à loja do carrinho', ci.product_id USING ERRCODE='42501';
    END IF;
    IF v_prod.status <> 'published' THEN
      RAISE EXCEPTION 'Produto % não está publicado (status=%)', ci.product_id, v_prod.status USING ERRCODE='22000';
    END IF;
    IF v_prod.visibility <> 'published' THEN
      RAISE EXCEPTION 'Produto % não está visível (visibility=%)', ci.product_id, v_prod.visibility USING ERRCODE='22000';
    END IF;
    IF v_cart.sales_channel = 'retail' AND v_prod.sale_channel NOT IN ('varejo','ambos') THEN
      RAISE EXCEPTION 'Produto % não disponível no canal varejo', ci.product_id USING ERRCODE='22000';
    END IF;
    IF v_cart.sales_channel = 'wholesale' AND v_prod.sale_channel NOT IN ('atacado','ambos') THEN
      RAISE EXCEPTION 'Produto % não disponível no canal atacado', ci.product_id USING ERRCODE='22000';
    END IF;

    SELECT * INTO v_variant FROM public.product_variants WHERE id = ci.variant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variante % não encontrada', ci.variant_id USING ERRCODE='P0002';
    END IF;
    IF v_variant.product_id <> ci.product_id THEN
      RAISE EXCEPTION 'Variante % não pertence ao produto %', ci.variant_id, ci.product_id USING ERRCODE='22000';
    END IF;
    IF NOT v_variant.is_active THEN
      RAISE EXCEPTION 'Variante % inativa', ci.variant_id USING ERRCODE='22000';
    END IF;

    -- Price revalidation for wholesale (retail catalog price kept as documented residual)
    IF v_cart.sales_channel = 'wholesale' THEN
      SELECT pli.price INTO v_expected_price
        FROM public.price_list_items pli
       WHERE pli.price_list_id = v_cart.price_list_id
         AND pli.variant_id    = ci.variant_id
         AND (pli.min_quantity IS NULL OR pli.min_quantity <= ci.qty)
         AND (pli.max_quantity IS NULL OR pli.max_quantity >= ci.qty)
       ORDER BY pli.min_quantity DESC NULLS LAST
       LIMIT 1;
      IF v_expected_price IS NULL THEN
        RAISE EXCEPTION 'Preço atacado não encontrado para variante %', ci.variant_id USING ERRCODE='22000';
      END IF;
      IF ROUND(ci.unit_price::numeric, 2) <> ROUND(v_expected_price::numeric, 2) THEN
        RAISE EXCEPTION 'Preço atacado divergente para variante % (carrinho=% atual=%)',
          ci.variant_id, ci.unit_price, v_expected_price USING ERRCODE='22000';
      END IF;
    END IF;
  END LOOP;

  -- ============ Shipping quote ============
  SELECT * INTO v_quote FROM public.shipping_quotes
   WHERE cart_id = _cart_id AND selected = true ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione uma modalidade de frete antes de finalizar' USING ERRCODE='22000'; END IF;

  -- ============ Customer resolution ============
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
    jsonb_build_object('source','storefront_checkout','sales_channel',v_cart.sales_channel), _idempotency_key
  ) RETURNING id INTO v_order_id;

  PERFORM public.consume_stock_reservations_for_order(v_order_id, _cart_id);

  INSERT INTO public.order_items(
    order_id, store_id, item_type, product_id, variant_id, sku, name,
    qty, list_price, unit_price, discount_amount, tax_amount, line_total, snapshot, metadata
  )
  SELECT v_order_id, v_cart.store_id, 'physical'::order_item_type,
         ci2.product_id, ci2.variant_id,
         (ci2.snapshot->>'sku'),
         COALESCE(ci2.snapshot->>'product_name','Item'),
         ci2.qty, ci2.list_price, ci2.unit_price, ci2.discount_amount, 0, ci2.line_total,
         ci2.snapshot, ci2.metadata
    FROM public.cart_items ci2 WHERE ci2.cart_id = _cart_id;

  INSERT INTO public.order_addresses(
    order_id, store_id, kind, recipient, phone, email,
    postal_code, street, number, complement, district, city, state, country, snapshot
  ) VALUES
   (v_order_id, v_cart.store_id, 'shipping', _name, _phone, _email,
    _address->>'postal_code', _address->>'street', _address->>'number',
    _address->>'complement', _address->>'district', _address->>'city',
    _address->>'state', COALESCE(_address->>'country','BR'), _address),
   (v_order_id, v_cart.store_id, 'billing', _name, _phone, _email,
    _address->>'postal_code', _address->>'street', _address->>'number',
    _address->>'complement', _address->>'district', _address->>'city',
    _address->>'state', COALESCE(_address->>'country','BR'), _address);

  PERFORM public.order_persist_shipping_snapshot(v_order_id, _cart_id);

  SELECT COALESCE(SUM(pv.weight_grams * ci3.qty), 0)::numeric INTO v_total_weight
    FROM public.cart_items ci3 LEFT JOIN public.product_variants pv ON pv.id = ci3.variant_id
   WHERE ci3.cart_id = _cart_id;

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

-- Remove the deprecated 5-arg overload so callers cannot bypass hardening via signature drift
DROP FUNCTION IF EXISTS public.order_create_from_cart(uuid, text, text, text, jsonb);

-- Revoke anon EXECUTE: retail carts can be anonymous but checkout must go through
-- an authenticated caller (session upgraded on checkout page) or the server function.
REVOKE EXECUTE ON FUNCTION public.order_create_from_cart(uuid, text, text, text, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.order_create_from_cart(uuid, text, text, text, jsonb, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.order_create_from_cart(uuid, text, text, text, jsonb, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.order_create_from_cart(uuid, text, text, text, jsonb, text) TO service_role;
