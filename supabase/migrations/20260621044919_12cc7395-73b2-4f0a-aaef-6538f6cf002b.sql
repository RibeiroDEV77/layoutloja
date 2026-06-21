
-- 1) Quotes: rastrear provider/conta/momento
ALTER TABLE public.shipping_quotes
  ADD COLUMN IF NOT EXISTS provider_code      text,
  ADD COLUMN IF NOT EXISTS carrier_account_id uuid REFERENCES public.shipping_carrier_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quoted_at          timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_shipping_quotes_provider
  ON public.shipping_quotes(provider_code, carrier_account_id);

-- 2) Order snapshot: rastrear provider/conta/momento
ALTER TABLE public.order_shipping_snapshots
  ADD COLUMN IF NOT EXISTS provider_code      text,
  ADD COLUMN IF NOT EXISTS carrier_account_id uuid REFERENCES public.shipping_carrier_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quoted_at          timestamptz;

-- 3) Conversão carrinho → pedido
CREATE OR REPLACE FUNCTION public.order_persist_shipping_snapshot(
  _order_id uuid,
  _cart_id  uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store    uuid;
  v_quote    public.shipping_quotes%ROWTYPE;
  v_snap_id  uuid;
BEGIN
  SELECT store_id INTO v_store FROM public.orders WHERE id = _order_id;
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_quote
    FROM public.shipping_quotes
   WHERE cart_id = _cart_id
     AND selected = true
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma cotação selecionada para o carrinho %', _cart_id
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.order_shipping_snapshots (
    order_id, store_id, carrier, service, price, eta_days,
    provider_code, carrier_account_id, quoted_at, snapshot
  ) VALUES (
    _order_id, v_store, v_quote.carrier, v_quote.method_code, v_quote.price,
    v_quote.estimated_days_max,
    v_quote.provider_code, v_quote.carrier_account_id, v_quote.quoted_at,
    jsonb_build_object(
      'quote_id',          v_quote.id,
      'method_id',         v_quote.method_id,
      'method_code',       v_quote.method_code,
      'method_name',       v_quote.method_name,
      'carrier',           v_quote.carrier,
      'provider_code',     v_quote.provider_code,
      'carrier_account_id',v_quote.carrier_account_id,
      'price',             v_quote.price,
      'estimated_days_min',v_quote.estimated_days_min,
      'estimated_days_max',v_quote.estimated_days_max,
      'postal_code',       v_quote.postal_code,
      'weight_g',          v_quote.weight_g,
      'quoted_at',         v_quote.quoted_at,
      'payload',           v_quote.payload
    )
  )
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_snap_id;

  RETURN v_snap_id;
END $$;

REVOKE ALL ON FUNCTION public.order_persist_shipping_snapshot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_persist_shipping_snapshot(uuid, uuid) TO authenticated, service_role;
